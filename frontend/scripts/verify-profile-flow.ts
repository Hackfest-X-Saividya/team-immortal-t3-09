import {
  authService,
  computeInitials,
  formatNameFromEmail,
  DEFAULT_DEMO_USER,
  DEFAULT_DEMO_SESSION,
  SESSION_STORAGE_KEY,
} from '../services/auth.service'
import type { UserProfile, UserSession } from '../types/auth'

// Mock browser localStorage
const mockStorage = new Map<string, string>()
const mockLocalStorage = {
  getItem: (key: string) => mockStorage.get(key) || null,
  setItem: (key: string, value: string) => mockStorage.set(key, String(value)),
  removeItem: (key: string) => mockStorage.delete(key),
  clear: () => mockStorage.clear(),
}

// Assign to global
;(globalThis as any).localStorage = mockLocalStorage
;(globalThis as any).window = globalThis

let totalPassed = 0
let totalTests = 0

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++
  if (condition) {
    console.log(`[PASS] ${testName}`)
    totalPassed++
  } else {
    console.error(`[FAIL] ${testName}: ${detail || 'Assertion failed'}`)
    process.exitCode = 1
  }
}

console.log('=== CARBONIQ SINGLE-WORKSPACE PROFILE & STATE MANAGEMENT TEST SUITE ===\n')

// TEST 1: Initials & Name Computation
console.log('--- TEST GROUP 1: Initials & Profile Formatting ---')
assert(computeInitials('Aarav Kapoor') === 'AK', 'Initials for "Aarav Kapoor" should be AK')
assert(computeInitials('Priya') === 'PR', 'Initials for single word "Priya" should be PR')
assert(computeInitials('Dr. Sunita Patel') === 'DP', 'Initials for "Dr. Sunita Patel" should be DP')
assert(computeInitials('') === 'CI', 'Empty name defaults to CI')
assert(
  formatNameFromEmail('priya.sharma@domain.com') === 'Priya Sharma',
  'formatNameFromEmail formats dot-separated email'
)
assert(
  formatNameFromEmail('aarav_kapoor@college.edu') === 'Aarav Kapoor',
  'formatNameFromEmail formats underscore-separated email'
)

// TEST 2: Demo Session Creation & Isolation
console.log('\n--- TEST GROUP 2: Demo Session Creation & Isolation ---')
mockLocalStorage.clear()
const demoSession = authService.createDemoSession()
assert(demoSession.mode === 'demo', 'Demo session mode is "demo"')
assert(demoSession.isAuthenticated === false, 'Demo session isAuthenticated is false')
assert(demoSession.user.name === 'Aarav Kapoor', 'Demo user name is "Aarav Kapoor"')
assert(demoSession.user.workspaceName === 'Demo Workspace', 'Demo user workspace is "Demo Workspace"')
assert(demoSession.user.id === 'demo-user-aarav', 'Demo user has stable ID "demo-user-aarav"')
assert(demoSession.user.initials === 'AK', 'Demo user initials are "AK"')

// Verify stored in mock storage
const rawStored = mockLocalStorage.getItem(SESSION_STORAGE_KEY)
assert(rawStored !== null, 'Demo session is persisted to storage')
const parsedStored = authService.getStoredSession()
assert(parsedStored?.user.name === 'Aarav Kapoor', 'Stored demo session retrieves correctly')

// TEST 3: Authenticated Mode Creation (Single Fixed Workspace)
console.log('\n--- TEST GROUP 3: Authenticated Mode Creation & Isolation ---')
const authSession = authService.signUpDemo({
  name: 'Sunita Patel',
  email: 'sunita.patel@iisc.ac.in',
  workspaceName: 'IISc Campus Operations',
})

assert(authSession.mode === 'authenticated', 'Authenticated session mode is "authenticated"')
assert(authSession.isAuthenticated === true, 'Authenticated session isAuthenticated is true')
assert(authSession.user.name === 'Sunita Patel', 'Authenticated name is "Sunita Patel"')
assert(authSession.user.email === 'sunita.patel@iisc.ac.in', 'Authenticated email is stored')
assert(
  authSession.user.workspaceName === 'IISc Campus Operations',
  'Authenticated workspace is preserved'
)
assert(authSession.user.initials === 'SP', 'Authenticated initials are "SP"')

// Verify persistence of authenticated profile
const storedAuth = authService.getStoredSession()
assert(storedAuth?.mode === 'authenticated', 'Stored session remembers authenticated mode')
assert(storedAuth?.user.name === 'Sunita Patel', 'Stored session remembers user name')
assert(
  storedAuth?.user.workspaceName === 'IISc Campus Operations',
  'Stored session remembers workspaceName'
)

// TEST 4: Sign In flow
console.log('\n--- TEST GROUP 4: Sign In Demo Flow ---')
const signedIn = authService.signInDemo('rohit.sharma@greentech.org', 'Rohit Sharma', 'GreenTech Labs')
assert(signedIn.mode === 'authenticated', 'Signed-in session is authenticated')
assert(signedIn.user.name === 'Rohit Sharma', 'Signed-in user name is Rohit Sharma')
assert(signedIn.user.workspaceName === 'GreenTech Labs', 'Signed-in workspace is GreenTech Labs')
assert(signedIn.user.initials === 'RS', 'Signed-in initials are RS')

// TEST 5: Corrupted / Invalid Storage Resilience
console.log('\n--- TEST GROUP 5: Storage Resilience & Recovery ---')
mockLocalStorage.setItem(SESSION_STORAGE_KEY, 'invalid json {!')
const recoveryFromCorrupt = authService.getStoredSession()
assert(recoveryFromCorrupt === null, 'Corrupt JSON safely returns null without throwing')

mockLocalStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ mode: 'unknown', foo: 'bar' }))
const recoveryFromInvalid = authService.getStoredSession()
assert(recoveryFromInvalid === null, 'Invalid schema returns null safely')

// TEST 6: Sign-Out Flow
console.log('\n--- TEST GROUP 6: Sign-Out Flow & Cleanup ---')
// Re-establish an authenticated session
authService.saveSession(signedIn)
assert(authService.getStoredSession()?.user.name === 'Rohit Sharma', 'Session active before sign-out')

// Execute sign out
authService.signOut()
assert(mockLocalStorage.getItem(SESSION_STORAGE_KEY) === null, 'Storage cleared on sign-out')

// Create fresh demo session after sign out
const postSignOutDemo = authService.createDemoSession()
assert(postSignOutDemo.mode === 'demo', 'Post sign-out session is demo mode')
assert(postSignOutDemo.isAuthenticated === false, 'Post sign-out isAuthenticated is false')
assert(postSignOutDemo.user.name === 'Aarav Kapoor', 'Post sign-out displays default demo Aarav Kapoor')
assert(postSignOutDemo.user.workspaceName === 'Demo Workspace', 'Post sign-out workspace is Demo Workspace')

console.log(`\n========================================`)
console.log(`TEST SUMMARY: ${totalPassed}/${totalTests} tests passed.`)
console.log(`========================================\n`)

if (totalPassed !== totalTests) {
  process.exit(1)
}
