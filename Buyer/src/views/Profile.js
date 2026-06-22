import { account, databases, DB_ID, COL_BUYER, COL_CARDINFO, COL_BOOKING, ID } from '../appwrite.js';
import { navigateTo } from '../main.js';

export default class Profile {
    constructor() {
        document.title = "Bedrock | Profile";
        this.buyerId = null;
        this.buyer = null;
        this.cards = [];
    }

    async render() {
        return `
            <div style="max-width: 800px; margin: 0 auto;">
                <h1 style="color: var(--accent); margin-bottom: 2rem;">Profile</h1>
                
                <div style="display: flex; gap: 1rem; margin-bottom: 2rem; border-bottom: 1px solid var(--glass-border); padding-bottom: 1rem;">
                    <button class="btn tab-btn" data-tab="details" style="background:var(--accent);">Details</button>
                    <button class="btn tab-btn" data-tab="payment" style="background:transparent; border: 1px solid var(--accent); color: var(--accent);">Payment</button>
                </div>

                <div id="tab-content" class="card">
                    <div style="text-align:center;">Loading...</div>
                </div>
            </div>
        `;
    }

    async mounted() {
        try {
            const user = await account.get();
            let buyerId = user.prefs && user.prefs.buyerId;
            if (!buyerId) {
                // Fallback if prefs couldn't be saved due to 401 cookie block
                const { Query } = await import('appwrite');
                const buyers = await databases.listDocuments(DB_ID, COL_BUYER, [Query.equal('Email', user.email)]);
                if (buyers.documents.length > 0) {
                    buyerId = buyers.documents[0].$id;
                } else {
                    throw new Error("Not a buyer account");
                }
            }
            this.buyerId = buyerId;
            
            await this.loadData();
            this.setupTabs();
            this.renderTab('details');
        } catch (err) {
            console.error("Profile load error", err);
            navigateTo('/login');
        }
    }

    async loadData() {
        this.buyer = await databases.getDocument(DB_ID, COL_BUYER, this.buyerId);
        
        try {
            const { Query } = await import('appwrite');
            const cardsRes = await databases.listDocuments(DB_ID, COL_CARDINFO, [
                Query.equal('Buyer', this.buyerId)
            ]);
            this.cards = cardsRes.documents;
        } catch (e) {
            console.error("Failed to fetch cards directly by Buyer ID", e);
            this.cards = [];
        }
    }

    setupTabs() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach(b => {
                    b.style.background = 'transparent';
                    b.style.color = 'var(--accent)';
                });
                btn.style.background = 'var(--accent)';
                btn.style.color = 'white';
                this.renderTab(btn.getAttribute('data-tab'));
            });
        });
    }

    renderTab(tab) {
        const content = document.getElementById('tab-content');
        if (tab === 'details') {
            // Determine current theme
            const currentTheme = document.body.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
            
            content.innerHTML = `
                <form id="details-form">
                    <label>Name</label>
                    <input type="text" id="buyer-name" value="${this.buyer.Name || ''}" required />
                    
                    <label>Email</label>
                    <input type="email" value="${this.buyer.Email || ''}" disabled title="Email cannot be changed" />
                    
                    <label>Phone Number</label>
                    <input type="text" id="buyer-phone" value="${this.buyer.PhoneNumber || ''}" required />
                    
                    <label>App Theme</label>
                    <select id="buyer-theme">
                        <option value="light" ${currentTheme === 'light' ? 'selected' : ''}>Light Mode</option>
                        <option value="dark" ${currentTheme === 'dark' ? 'selected' : ''}>Dark Mode</option>
                    </select>

                    <button type="submit" class="btn">Update Details</button>
                </form>
            `;
            document.getElementById('details-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                const btn = e.target.querySelector('button');
                btn.disabled = true;
                btn.textContent = "Updating...";
                try {
                    await databases.updateDocument(DB_ID, COL_BUYER, this.buyerId, {
                        Name: document.getElementById('buyer-name').value,
                        PhoneNumber: document.getElementById('buyer-phone').value
                    });
                    
                    // Update theme preference
                    const selectedTheme = document.getElementById('buyer-theme').value;
                    const user = await account.get();
                    const newPrefs = { ...user.prefs, theme: selectedTheme };
                    await account.updatePrefs(newPrefs);
                    
                    // Apply theme immediately
                    if (selectedTheme === 'dark') {
                        document.body.setAttribute('data-theme', 'dark');
                    } else {
                        document.body.removeAttribute('data-theme');
                    }

                    alert("Details updated successfully");
                } catch(err) {
                    console.error(err);
                    alert("Update failed.");
                } finally {
                    btn.disabled = false;
                    btn.textContent = "Update Details";
                }
            });
        } else if (tab === 'payment') {
            const cardListHTML = this.cards.map(c => `
                <div style="background: var(--bg-secondary); border: 1px solid var(--glass-border); padding: 1rem; border-radius: 0.5rem; margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <p style="font-weight: bold;">Card ending in ${c.CardNbr ? c.CardNbr.slice(-4) : '...'}</p>
                        <p style="font-size: 0.9rem; color: var(--text-secondary);">Exp: ${c.ExpDate ? new Date(c.ExpDate).toLocaleDateString() : 'N/A'}</p>
                    </div>
                    <button class="btn btn-delete-card" data-id="${c.$id}" style="background: transparent; border: 1px solid var(--danger); color: var(--danger); padding: 0.25rem 0.5rem; font-size: 0.8rem;">Remove</button>
                </div>
            `).join('');

            content.innerHTML = `
                <h3 style="margin-bottom: 1rem;">Saved Cards</h3>
                ${this.cards.length > 0 ? cardListHTML : '<p style="color:var(--text-secondary); margin-bottom:1rem;">No saved cards found.</p>'}
                
                <h3 style="margin-bottom: 1rem; margin-top: 2rem;">Add New Card</h3>
                <form id="payment-form" style="background: var(--bg-secondary); padding: 1rem; border: 1px dashed var(--glass-border); border-radius: 0.5rem;">
                    <label>Card Number</label>
                    <input type="text" id="card-nbr" required placeholder="1234 5678 9101 1121" />
                    
                    <div style="display:flex; gap:1rem;">
                        <div style="flex:1;">
                            <label>Expiry Date</label>
                            <input type="date" id="card-exp" required />
                        </div>
                        <div style="flex:1;">
                            <label>CVV</label>
                            <input type="password" id="card-cvv" required maxlength="3" placeholder="123" />
                        </div>
                    </div>
                    
                    <button type="submit" class="btn" style="margin-top:1rem;">Save Card</button>
                </form>
            `;

            document.getElementById('payment-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                const btn = e.target.querySelector('button');
                btn.disabled = true;
                btn.textContent = "Saving...";
                try {
                    const newCard = await databases.createDocument(DB_ID, COL_CARDINFO, ID.unique(), {
                        CardNbr: document.getElementById('card-nbr').value,
                        ExpDate: new Date(document.getElementById('card-exp').value).toISOString(),
                        CVV: document.getElementById('card-cvv').value,
                        Buyer: this.buyerId
                    });
                    
                    let currentCards = [];
                    if (this.buyer.CardInfo && Array.isArray(this.buyer.CardInfo)) {
                        currentCards = this.buyer.CardInfo.map(c => typeof c === 'object' ? c.$id : c);
                    } else if (this.buyer.CardInfo && typeof this.buyer.CardInfo === 'object') {
                        currentCards = [this.buyer.CardInfo.$id];
                    } else if (this.buyer.CardInfo && typeof this.buyer.CardInfo === 'string') {
                        currentCards = [this.buyer.CardInfo];
                    }
                    currentCards.push(newCard.$id);
                    
                    await databases.updateDocument(DB_ID, COL_BUYER, this.buyerId, {
                        CardInfo: currentCards
                    });
                    
                    alert("Card saved successfully");
                    await this.loadData();
                    this.renderTab('payment');
                } catch(err) {
                    console.error(err);
                    alert("Save failed.");
                } finally {
                    btn.disabled = false;
                    btn.textContent = "Save Card";
                }
            });

            document.querySelectorAll('.btn-delete-card').forEach(btn => {
                btn.addEventListener('click', async () => {
                    if (confirm("Are you sure you want to remove this card?")) {
                        btn.textContent = "...";
                        btn.disabled = true;
                        try {
                            await databases.deleteDocument(DB_ID, COL_CARDINFO, btn.getAttribute('data-id'));
                            await this.loadData();
                            this.renderTab('payment');
                        } catch(err) {
                            console.error(err);
                            alert("Failed to remove card.");
                            btn.disabled = false;
                            btn.textContent = "Remove";
                        }
                    }
                });
            });
        }
    }
}
