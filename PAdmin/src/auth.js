import { databases, account, DB_ID, COLL_PADMIN, Query, ID } from './appwrite.js';

let currentPAdmin = null;

export async function checkSession() {
  try {
    // 1. Verify Appwrite auth service session exists
    const user = await account.get();
    
    // 2. Read preferences to determine role
    const prefs = await account.getPrefs();
    
    if (user && prefs.role === 'padmin' && prefs.padminId) {
      // 3. Load the associated PAdmin database record
      currentPAdmin = await databases.getDocument(DB_ID, COLL_PADMIN, prefs.padminId);
      return true;
    }
  } catch (err) {
    console.error('Session check failed:', err.message);
  }
  return false;
}

export async function login(email, password) {
  try {
    // 1. Pure Auth login
    await account.createEmailPasswordSession(email, password);
    
    // 2. Fetch User Prefs to determine access and fetch additional data
    const prefs = await account.getPrefs();
    if (prefs.role === 'padmin' && prefs.padminId) {
      currentPAdmin = await databases.getDocument(DB_ID, COLL_PADMIN, prefs.padminId);
      return true;
    } else {
      console.error('Unauthorized: User does not have a padmin role.');
      await account.deleteSession('current');
      return false;
    }
  } catch (err) {
    console.error('Login error:', err.message);
    return false;
  }
}

export async function logout() {
  currentPAdmin = null;
  try {
    await account.deleteSession('current');
  } catch (e) {
    console.error('Logout error:', e.message);
  }
  window.location.hash = '#/login';
}

export function getCurrentPAdmin() {
  return currentPAdmin;
}

export async function changePassword(oldPwd, newPwd) {
  if (!currentPAdmin) return false;

  try {
    // Update password in Appwrite Auth DB
    await account.updatePassword(newPwd, oldPwd);
    
    // Optional: Keep PAdmin DB record in sync
    await databases.updateDocument(DB_ID, COLL_PADMIN, currentPAdmin.$id, {
      Password: newPwd
    });
    currentPAdmin.Password = newPwd;
    
    return true;
  } catch (err) {
    console.error('Error changing password:', err.message);
    return false;
  }
}

export async function updateProfile(data) {
  if (!currentPAdmin) return false;
  try {
    const res = await databases.updateDocument(DB_ID, COLL_PADMIN, currentPAdmin.$id, data);
    currentPAdmin = res;
    return true;
  } catch (err) {
    console.error('Error updating profile:', err.message);
    return false;
  }
}
