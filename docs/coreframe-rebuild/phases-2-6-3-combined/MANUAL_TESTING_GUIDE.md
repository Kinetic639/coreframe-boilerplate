# Manual Testing Guide - Password Reset Flow

**Version:** 1.0
**Date:** 2026-01-15
**Feature:** Complete Password Reset Flow with PKCE

## Prerequisites

Before testing, ensure:

1. ✅ **Development server is running**: `npm run dev`
2. ✅ **Supabase SMTP is configured** with Resend credentials
3. ✅ **Test user account exists** in your Supabase database
4. ✅ **Email address is accessible** for receiving test emails

## Test Environment Setup

### 1. Verify Environment Variables

Ensure these are set in your `.env.local`:

```bash
RESEND_API_KEY=re_xxxxxxxxxxxxx
RESEND_FROM_EMAIL=your-verified-email@domain.com
RESEND_FROM_NAME=Coreframe
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 2. Verify Supabase SMTP Configuration

1. Go to Supabase Dashboard → Project Settings → Auth → SMTP Settings
2. Verify:
   - Host: `smtp.resend.com`
   - Port: `465`
   - Username: `resend`
   - Password: Your `RESEND_API_KEY`
   - Sender email matches your verified Resend domain
   - Enable SMTP is checked

## Test Scenarios

---

## Happy Path Tests

### Test 1: Complete Password Reset Flow

**Objective:** Verify the entire password reset process works end-to-end

**Steps:**

1. Navigate to `http://localhost:3000/forgot-password`
2. Enter a valid test user email address
3. Click "Send reset instructions"
4. Check your email inbox for the password reset email
5. Click the reset link in the email
6. Verify you're redirected to `/reset-password` page
7. Enter a new password: `NewPassword123`
8. Enter the same password in confirm field
9. Observe the password strength indicator shows "Strong"
10. Click "Reset password"
11. Verify you're redirected to `/sign-in` page
12. Sign in with the new password

**Expected Results:**

- ✅ Success message appears after requesting reset
- ✅ Email is received within 1-2 minutes
- ✅ Email contains a clickable link
- ✅ Reset password page loads successfully
- ✅ Password strength indicator updates in real-time
- ✅ All 4 requirements show green checkmarks for valid password
- ✅ Form submits successfully
- ✅ User is signed out automatically
- ✅ Can sign in with new password

**Status:** ⬜ Pass / ⬜ Fail

---

### Test 2: Password Strength Indicator

**Objective:** Verify password strength indicator works correctly

**Steps:**

1. Navigate to reset password page (use valid reset link)
2. Type progressively stronger passwords and observe indicator:
   - `abc` → Should show "Weak" (red) - only lowercase
   - `Abc` → Should show "Fair" (orange) - lowercase + uppercase
   - `Abc1` → Should show "Good" (yellow) - lowercase + uppercase + number
   - `Abcdefg1` → Should show "Strong" (green) - all requirements + 8 chars

**Expected Results:**

- ✅ Strength meter animates smoothly
- ✅ Color changes match strength level
- ✅ Requirement checklist updates in real-time
- ✅ Green checkmarks appear for met requirements
- ✅ Red X marks appear for unmet requirements

**Status:** ⬜ Pass / ⬜ Fail

---

### Test 3: Show/Hide Password Toggle

**Objective:** Verify password visibility toggle works

**Steps:**

1. Navigate to reset password page
2. Enter password in first field
3. Click the eye icon
4. Verify password becomes visible
5. Click eye icon again
6. Verify password is hidden
7. Repeat for confirm password field

**Expected Results:**

- ✅ Password toggles between visible and hidden
- ✅ Icon changes between eye and eye-off
- ✅ Both password fields work independently
- ✅ No layout shifts when toggling

**Status:** ⬜ Pass / ⬜ Fail

---

## Error Handling Tests

### Test 4: Invalid Email Format

**Objective:** Verify email validation on forgot password page

**Steps:**

1. Navigate to `http://localhost:3000/forgot-password`
2. Enter invalid emails and submit:
   - `notanemail`
   - `missing@domain`
   - `@nodomain.com`
   - `spaces in email@test.com`

**Expected Results:**

- ✅ Error message: "Invalid email format"
- ✅ Form does not submit
- ✅ User stays on forgot password page

**Status:** ⬜ Pass / ⬜ Fail

---

### Test 5: Password Too Short

**Objective:** Verify minimum password length validation

**Steps:**

1. Navigate to reset password page (valid link)
2. Enter password: `Short1` (7 characters)
3. Enter same in confirm field
4. Click "Reset password"

**Expected Results:**

- ✅ Error message: "Password must be at least 8 characters"
- ✅ Password strength shows red "Weak"
- ✅ Length requirement shows red X
- ✅ Form does not submit

**Status:** ⬜ Pass / ⬜ Fail

---

### Test 6: Missing Uppercase Letter

**Objective:** Verify uppercase letter requirement

**Steps:**

1. Navigate to reset password page
2. Enter password: `password123` (no uppercase)
3. Enter same in confirm field
4. Click "Reset password"

**Expected Results:**

- ✅ Error message: "Password must contain an uppercase letter"
- ✅ Uppercase requirement shows red X
- ✅ Form does not submit

**Status:** ⬜ Pass / ⬜ Fail

---

### Test 7: Missing Lowercase Letter

**Objective:** Verify lowercase letter requirement

**Steps:**

1. Navigate to reset password page
2. Enter password: `PASSWORD123` (no lowercase)
3. Enter same in confirm field
4. Click "Reset password"

**Expected Results:**

- ✅ Error message: "Password must contain a lowercase letter"
- ✅ Lowercase requirement shows red X
- ✅ Form does not submit

**Status:** ⬜ Pass / ⬜ Fail

---

### Test 8: Missing Number

**Objective:** Verify number requirement

**Steps:**

1. Navigate to reset password page
2. Enter password: `Password` (no number)
3. Enter same in confirm field
4. Click "Reset password"

**Expected Results:**

- ✅ Error message: "Password must contain a number"
- ✅ Number requirement shows red X
- ✅ Form does not submit

**Status:** ⬜ Pass / ⬜ Fail

---

### Test 9: Passwords Don't Match

**Objective:** Verify password confirmation matching

**Steps:**

1. Navigate to reset password page
2. Enter password: `Password123`
3. Enter confirm: `Password456`
4. Click "Reset password"

**Expected Results:**

- ✅ Error message: "Passwords do not match"
- ✅ Form does not submit
- ✅ Error appears on confirm password field

**Status:** ⬜ Pass / ⬜ Fail

---

### Test 10: Expired Reset Link

**Objective:** Verify expired token handling

**Steps:**

1. Request password reset email
2. Wait for link to expire (default: 1 hour) OR manually modify token_hash
3. Click the expired/invalid link

**Expected Results:**

- ✅ Redirected to `/auth/auth-code-error` page
- ✅ Friendly error message displayed
- ✅ "Request New Link" button present
- ✅ "Back to Sign In" button present

**Status:** ⬜ Pass / ⬜ Fail

---

### Test 11: Already-Used Reset Link

**Objective:** Verify one-time use of reset tokens

**Steps:**

1. Request password reset
2. Use link to reset password successfully
3. Try to use the same link again

**Expected Results:**

- ✅ Redirected to `/auth/auth-code-error` page
- ✅ Error message about invalid/expired link
- ✅ Cannot reuse the same token

**Status:** ⬜ Pass / ⬜ Fail

---

### Test 12: Accessing Reset Page Without Token

**Objective:** Verify security - cannot access reset page directly

**Steps:**

1. Navigate directly to `http://localhost:3000/reset-password` (without valid session)
2. Observe what happens

**Expected Results:**

- ✅ Redirected to `/forgot-password` page
- ✅ Cannot access reset page without recovery session

**Status:** ⬜ Pass / ⬜ Fail

---

### Test 13: Non-Existent Email (Security)

**Objective:** Verify system doesn't reveal if email exists

**Steps:**

1. Navigate to forgot password page
2. Enter email that doesn't exist: `nonexistent@example.com`
3. Submit form

**Expected Results:**

- ✅ Success message still shows: "If an account exists..."
- ✅ No error revealing email doesn't exist
- ✅ No email is actually sent (check inbox)

**Status:** ⬜ Pass / ⬜ Fail

---

## UI/UX Tests

### Test 14: Mobile Responsiveness

**Objective:** Verify forms work on mobile devices

**Steps:**

1. Open browser dev tools
2. Switch to mobile view (iPhone 12 or similar)
3. Test forgot password form
4. Test reset password form
5. Verify password strength indicator
6. Verify show/hide buttons

**Expected Results:**

- ✅ Forms are fully visible and usable
- ✅ No horizontal scrolling needed
- ✅ Buttons are easily clickable (touch-friendly)
- ✅ Password strength indicator fits screen
- ✅ All text is readable

**Status:** ⬜ Pass / ⬜ Fail

---

### Test 15: Loading States

**Objective:** Verify loading indicators during form submission

**Steps:**

1. Navigate to forgot password page
2. Enter email and submit
3. Observe button during submission
4. Repeat for reset password page

**Expected Results:**

- ✅ Button shows loading state
- ✅ Button is disabled during submission
- ✅ User cannot double-submit
- ✅ Loading text appears (if configured)

**Status:** ⬜ Pass / ⬜ Fail

---

### Test 16: Internationalization (Polish)

**Objective:** Verify Polish translations work

**Steps:**

1. Navigate to `http://localhost:3000/pl/zapomnialem-hasla`
2. Verify all text is in Polish
3. Navigate to `http://localhost:3000/pl/zresetuj-haslo` (with valid token)
4. Verify password strength labels are in Polish

**Expected Results:**

- ✅ All UI text is in Polish
- ✅ Error messages are in Polish
- ✅ Password strength requirements in Polish
- ✅ Routes use Polish slugs

**Status:** ⬜ Pass / ⬜ Fail

---

## Performance Tests

### Test 17: Page Load Speed

**Objective:** Verify pages load quickly

**Steps:**

1. Open browser dev tools → Network tab
2. Navigate to forgot password page
3. Note load time
4. Navigate to reset password page
5. Note load time

**Expected Results:**

- ✅ Pages load in < 2 seconds
- ✅ No console errors
- ✅ No layout shifts (CLS)

**Status:** ⬜ Pass / ⬜ Fail

---

## Accessibility Tests

### Test 18: Keyboard Navigation

**Objective:** Verify forms are keyboard accessible

**Steps:**

1. Navigate to forgot password page
2. Use Tab key to move through form
3. Use Enter to submit
4. Repeat for reset password page

**Expected Results:**

- ✅ Can navigate entire form with keyboard
- ✅ Focus indicators are visible
- ✅ Can submit form with Enter key
- ✅ Password toggle accessible via keyboard

**Status:** ⬜ Pass / ⬜ Fail

---

### Test 19: Screen Reader Compatibility

**Objective:** Verify forms work with screen readers

**Steps:**

1. Enable screen reader (VoiceOver on Mac, NVDA on Windows)
2. Navigate through forgot password form
3. Navigate through reset password form
4. Verify password strength announcements

**Expected Results:**

- ✅ Form labels are announced
- ✅ Error messages are announced
- ✅ Password strength status is communicated
- ✅ All interactive elements have proper labels

**Status:** ⬜ Pass / ⬜ Fail

---

## Test Summary

**Total Tests:** 19
**Passed:** **_
**Failed:** _**
**Blocked:** **_
**Not Tested:** _**

**Critical Issues Found:**

- [ ] None
- [ ] List issues here...

**Minor Issues Found:**

- [ ] None
- [ ] List issues here...

**Tested By:** ********\_********
**Date:** ********\_********
**Environment:** Development / Staging / Production
**Browser(s):** ********\_********

---

## Post-Testing Checklist

After completing all tests:

- [ ] All critical path tests passed
- [ ] No console errors during testing
- [ ] Email delivery working reliably
- [ ] Mobile experience is good
- [ ] Accessibility requirements met
- [ ] Performance is acceptable
- [ ] Ready for production deployment

---

## Known Limitations

1. **Email Delay**: Emails may take 1-2 minutes to arrive depending on Resend's queue
2. **Token Expiry**: Reset tokens expire after 1 hour by default
3. **Rate Limiting**: Supabase may rate-limit password reset requests (security feature)

---

## Troubleshooting

### Email Not Received

1. Check spam/junk folder
2. Verify SMTP configuration in Supabase Dashboard
3. Check Resend API key is valid
4. Verify sender email is verified in Resend
5. Check Resend dashboard for delivery logs

### Reset Link Not Working

1. Verify token hasn't expired (< 1 hour old)
2. Check for URL encoding issues
3. Verify `/auth/confirm` route is accessible
4. Check browser console for errors

### Password Requirements Not Met

1. Ensure password is at least 8 characters
2. Include at least one uppercase letter (A-Z)
3. Include at least one lowercase letter (a-z)
4. Include at least one number (0-9)

---

**End of Manual Testing Guide**
