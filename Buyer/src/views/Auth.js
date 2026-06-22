import { account, databases, DB_ID, COL_BUYER, COL_CARDINFO, ID } from '../appwrite.js';
import { navigateTo, updateNavbar } from '../main.js';

export class LoginView {
    constructor() {
        document.title = "Bedrock | Login";
    }

    async render() {
        return `
            <div style="max-width: 400px; margin: 2rem auto;" class="card">
                <h2 style="margin-bottom: 1.5rem; text-align: center; color: var(--accent);">Login</h2>
                <div id="login-error" class="error-msg"></div>
                <form id="login-form">
                    <label>Email</label>
                    <input type="email" id="email" required />
                    
                    <label>Password</label>
                    <div style="position: relative;">
                        <input type="password" id="password" required minlength="8" />
                        <button type="button" id="toggle-password" style="position: absolute; right: 10px; top: 12px; background: transparent; border: none; cursor: pointer; color: var(--text-secondary); font-size: 0.8rem; font-weight: 600;">SHOW</button>
                    </div>
                    
                    <button type="submit" class="btn" style="width: 100%; margin-top: 1rem;">Login</button>
                </form>
                <p style="text-align: center; margin-top: 1.5rem; font-size: 0.9rem;">
                    Don't have an account? <a href="/signup" data-link style="color: var(--accent);">Sign up</a>
                </p>
            </div>
        `;
    }

    async mounted() {
        try {
            const user = await account.get();
            const { Query } = await import('appwrite');
            const buyers = await databases.listDocuments(DB_ID, COL_BUYER, [Query.equal('Email', user.email)]);
            
            if (buyers.documents.length > 0) {
                navigateTo('/bookings');
                return;
            } else {
                // If they are an admin who somehow navigated here, log them out
                await account.deleteSession('current');
            }
        } catch(e) {}

        const form = document.getElementById('login-form');
        const errorDiv = document.getElementById('login-error');
        const toggleBtn = document.getElementById('toggle-password');
        const passInput = document.getElementById('password');

        toggleBtn.addEventListener('click', () => {
            const type = passInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passInput.setAttribute('type', type);
            toggleBtn.textContent = type === 'password' ? 'SHOW' : 'HIDE';
        });
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            errorDiv.textContent = '';
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            
            try {
                await account.createEmailPasswordSession(email, password);
                
                // Verify they are actually a buyer
                const user = await account.get();
                const { Query } = await import('appwrite');
                const buyers = await databases.listDocuments(DB_ID, COL_BUYER, [Query.equal('Email', user.email)]);
                
                if (buyers.documents.length === 0) {
                    await account.deleteSession('current');
                    throw new Error("Not a buyer account");
                }
                
                await updateNavbar();
                navigateTo('/bookings');
            } catch (err) {
                console.error(err);
                errorDiv.textContent = "Incorrect email or password.";
            }
        });
    }
}

export class SignupView {
    constructor() {
        document.title = "Bedrock | Sign Up";
    }

    async render() {
        return `
            <div style="max-width: 400px; margin: 2rem auto;" class="card">
                <h2 style="margin-bottom: 1.5rem; text-align: center; color: var(--accent);">Sign Up</h2>
                <div id="signup-error" class="error-msg"></div>
                <form id="signup-form">
                    <label>Name</label>
                    <input type="text" id="name" required />

                    <label>Email</label>
                    <input type="email" id="email" required />

                    <label>Phone Number</label>
                    <input type="text" id="phone" required />
                    
                    <label>Password</label>
                    <div style="position: relative;">
                        <input type="password" id="password" required minlength="8" />
                        <button type="button" class="toggle-password" data-target="password" style="position: absolute; right: 10px; top: 12px; background: transparent; border: none; cursor: pointer; color: var(--text-secondary); font-size: 0.8rem; font-weight: 600;">SHOW</button>
                    </div>

                    <label>Confirm Password</label>
                    <div style="position: relative;">
                        <input type="password" id="confirm-password" required minlength="8" />
                        <button type="button" class="toggle-password" data-target="confirm-password" style="position: absolute; right: 10px; top: 12px; background: transparent; border: none; cursor: pointer; color: var(--text-secondary); font-size: 0.8rem; font-weight: 600;">SHOW</button>
                    </div>
                    
                    <button type="submit" class="btn" style="width: 100%; margin-top: 1rem;">Sign Up</button>
                </form>
                <p style="text-align: center; margin-top: 1.5rem; font-size: 0.9rem;">
                    Already have an account? <a href="/login" data-link style="color: var(--accent);">Login</a>
                </p>
            </div>
        `;
    }

    async mounted() {
        try {
            await account.get();
            // If logged in, redirect away
            navigateTo('/bookings');
            return;
        } catch(e) {}

        const form = document.getElementById('signup-form');
        const errorDiv = document.getElementById('signup-error');

        document.querySelectorAll('.toggle-password').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetId = e.target.getAttribute('data-target');
                const input = document.getElementById(targetId);
                const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
                input.setAttribute('type', type);
                e.target.textContent = type === 'password' ? 'SHOW' : 'HIDE';
            });
        });

        // Real-time password match checker
        const passInput = document.getElementById('password');
        const confInput = document.getElementById('confirm-password');
        const validateMatch = () => {
            if (confInput.value && passInput.value !== confInput.value) {
                confInput.style.borderColor = 'var(--danger)';
            } else if (confInput.value) {
                confInput.style.borderColor = 'var(--success)';
            } else {
                confInput.style.borderColor = 'var(--glass-border)';
            }
        };
        passInput.addEventListener('input', validateMatch);
        confInput.addEventListener('input', validateMatch);

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            errorDiv.textContent = '';
            
            const name = document.getElementById('name').value;
            const email = document.getElementById('email').value;
            const phone = document.getElementById('phone').value;
            const password = passInput.value;
            const confirm = confInput.value;

            if (password.length < 8) {
                errorDiv.textContent = "Password must be at least 8 characters long.";
                return;
            }

            if (password !== confirm) {
                errorDiv.textContent = "Passwords do not match.";
                return;
            }

            try {
                // 1. Create Appwrite Account
                const userAccount = await account.create(ID.unique(), email, password, name);
                
                // 2. Login immediately to establish session so db operations have permission
                await account.createEmailPasswordSession(email, password);
                
                // 3. Create CardInfo empty doc
                const cardDoc = await databases.createDocument(DB_ID, COL_CARDINFO, ID.unique(), {
                    CardNbr: "",
                    ExpDate: null,
                    CVV: ""
                });

                // 4. Create Buyer record
                const buyerDoc = await databases.createDocument(DB_ID, COL_BUYER, ID.unique(), {
                    Name: name,
                    Email: email,
                    PhoneNumber: phone,
                    Password: "", // Left empty for security
                    CardInfo: [cardDoc.$id]
                });

                // 5. Update CardInfo inverse relation
                await databases.updateDocument(DB_ID, COL_CARDINFO, cardDoc.$id, {
                    Buyer: buyerDoc.$id
                });

                // 6. Set user preferences
                try {
                    await account.updatePrefs({ role: 'buyer', buyerId: buyerDoc.$id });
                } catch (prefError) {
                    console.warn("Could not update user prefs (401). This is usually because your browser is blocking third-party cookies for fra.cloud.appwrite.io on localhost, or localhost is not added as a Web Platform in your Appwrite console.", prefError);
                }
                
                // 7. Redirect to catalogue
                await updateNavbar();
                navigateTo('/catalogue');

            } catch (err) {
                console.error(err);
                errorDiv.textContent = err.message || "Failed to sign up.";
            }
        });
    }
}
