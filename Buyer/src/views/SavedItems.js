import { databases, account, DB_ID, syncSavedItem } from '../appwrite.js';
import { navigateTo } from '../main.js';

export default class SavedItems {
    constructor() {
        document.title = "Bedrock | Saved Items";
        this.savedBuildings = [];
        this.savedRooms = [];
    }

    async render() {
        return `
            <div style="max-width: 1200px; margin: 0 auto;">
                <h1 style="font-size: 2.5rem; color: var(--accent); margin-bottom: 2rem;">Saved Items</h1>
                <div id="saved-items-container">
                    <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">Loading your saved items...</div>
                </div>
            </div>
        `;
    }

    async mounted() {
        await this.loadData();
    }

    async loadData() {
        try {
            const { Query } = await import('appwrite');
            
            let bIds = [];
            let rIds = [];
            try {
                const bSaved = localStorage.getItem('bedrock_saved_buildings');
                if (bSaved) bIds = JSON.parse(bSaved);
                const rSaved = localStorage.getItem('bedrock_saved_rooms');
                if (rSaved) rIds = JSON.parse(rSaved);
            } catch(e) {}
            
            // Fetch Saved Buildings
            if (bIds.length > 0) {
                try {
                    const buildingsRes = await databases.listDocuments(DB_ID, 'building', [
                        Query.equal('$id', bIds),
                        Query.limit(100)
                    ]);
                    // Map them to match expected format (doc.Building)
                    this.savedBuildings = buildingsRes.documents.map(b => ({ Building: b, $id: b.$id }));
                } catch (e) {
                    console.warn("Failed to fetch some saved buildings", e);
                }
            } else {
                this.savedBuildings = [];
            }

            // Fetch Saved Rooms
            if (rIds.length > 0) {
                try {
                    const roomsRes = await databases.listDocuments(DB_ID, 'room', [
                        Query.equal('$id', rIds),
                        Query.limit(100)
                    ]);
                    // Map them to match expected format (doc.Room)
                    this.savedRooms = roomsRes.documents.map(r => ({ Room: r, $id: r.$id }));
                } catch (e) {
                    console.warn("Failed to fetch some saved rooms", e);
                }
            } else {
                this.savedRooms = [];
            }

            this.renderContent();
        } catch (e) {
            console.error("Failed to load saved items", e);
            document.getElementById('saved-items-container').innerHTML = `
                <div style="color: var(--danger); padding: 2rem; border: 1px solid var(--danger); border-radius: 0.5rem;">
                    Failed to load your saved items. Please try again later.
                </div>
            `;
        }
    }

    renderContent() {
        const container = document.getElementById('saved-items-container');
        
        let html = '';

        // Buildings Section
        html += `<h2 style="font-size: 1.75rem; margin-bottom: 1.5rem; color: var(--text-primary); border-bottom: 1px solid var(--glass-border); padding-bottom: 0.5rem;">Saved Buildings</h2>`;
        if (this.savedBuildings.length === 0) {
            html += `<p style="color: var(--text-secondary); margin-bottom: 3rem; font-style: italic;">You haven't saved any buildings yet.</p>`;
        } else {
            html += `<div style="background: var(--bg-color); border: 1px solid var(--glass-border); border-radius: 0.75rem; overflow: hidden; margin-bottom: 3rem;">`;
            html += this.savedBuildings.map(doc => {
                const b = doc.Building;
                return `
                    <div style="display: flex; flex-wrap: wrap; gap: 1.5rem; justify-content: space-between; align-items: center; padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--glass-border);">
                        <div style="flex: 2; min-width: 250px;">
                            <h3 style="margin-bottom: 0.25rem; font-size: 1.25rem; color: var(--accent);">${b.Name}</h3>
                            <div style="color: var(--text-secondary); font-size: 0.95rem;">${b.Type} &bull; ${b.Address}</div>
                        </div>
                        <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                            <button class="btn btn-explore" data-url="/building/${b.$id}" style="background: var(--bg-secondary); border: 1px solid var(--glass-border); color: var(--text-primary); min-width: 100px;">Explore</button>
                            <button class="btn btn-remove-building" data-doc="${doc.$id}" style="background: transparent; border: 1px solid var(--danger); color: var(--danger); min-width: 100px;">Remove</button>
                        </div>
                    </div>
                `;
            }).join('');
            html += `</div>`;
        }

        // Rooms Section
        html += `<h2 style="font-size: 1.75rem; margin-bottom: 1.5rem; color: var(--text-primary); border-bottom: 1px solid var(--glass-border); padding-bottom: 0.5rem;">Saved Rooms</h2>`;
        if (this.savedRooms.length === 0) {
            html += `<p style="color: var(--text-secondary); margin-bottom: 3rem; font-style: italic;">You haven't saved any rooms yet.</p>`;
        } else {
            html += `<div style="background: var(--bg-color); border: 1px solid var(--glass-border); border-radius: 0.75rem; overflow: hidden; margin-bottom: 3rem;">`;
            html += this.savedRooms.map(doc => {
                const r = doc.Room;
                // Since Appwrite populated the relationship, we might just have the room data.
                // We don't have the parent Building hydrated perfectly unless Appwrite did it natively.
                const bId = (typeof r.Building === 'object' && r.Building !== null) ? r.Building.$id : r.Building;
                const bName = (typeof r.Building === 'object' && r.Building !== null) ? r.Building.Name : 'Building';

                return `
                    <div style="display: flex; flex-wrap: wrap; gap: 1.5rem; justify-content: space-between; align-items: center; padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--glass-border);">
                        <div style="flex: 2; min-width: 250px;">
                            <h3 style="margin-bottom: 0.25rem; font-size: 1.25rem; color: var(--accent);">${r.RoomName} <span style="font-size:0.9rem; color:var(--text-secondary); font-weight:normal;">in ${bName}</span></h3>
                            <div style="color: var(--text-secondary); font-size: 0.95rem;">
                                Beds: ${r.NbrBeds || 0} &bull; Baths: ${r.NbrBathrooms || 0} &bull; 
                                <span style="font-weight: 600; color: var(--text-primary);">₦${(r.RoomPrice || 0).toLocaleString()}</span>
                            </div>
                        </div>
                        <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                            <button class="btn btn-explore" data-url="/building/${bId}#room-${r.$id}" style="background: var(--bg-secondary); border: 1px solid var(--glass-border); color: var(--text-primary); min-width: 100px;">Explore</button>
                            <button class="btn btn-remove-room" data-doc="${doc.$id}" style="background: transparent; border: 1px solid var(--danger); color: var(--danger); min-width: 100px;">Remove</button>
                        </div>
                    </div>
                `;
            }).join('');
            html += `</div>`;
        }

        container.innerHTML = html;

        // Attach events
        container.querySelectorAll('.btn-explore').forEach(btn => {
            btn.addEventListener('click', () => navigateTo(btn.getAttribute('data-url')));
        });

        container.querySelectorAll('.btn-remove-building').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const docId = btn.getAttribute('data-doc'); // this is building ID
                try {
                    let bIds = [];
                    const bSaved = localStorage.getItem('bedrock_saved_buildings');
                    if (bSaved) bIds = JSON.parse(bSaved);
                    bIds = bIds.filter(id => id !== docId);
                    localStorage.setItem('bedrock_saved_buildings', JSON.stringify(bIds));
                    
                    syncSavedItem('building', docId, 'remove');

                    this.savedBuildings = this.savedBuildings.filter(d => d.$id !== docId);
                    this.renderContent();
                } catch (err) {
                    console.error(err);
                }
            });
        });

        container.querySelectorAll('.btn-remove-room').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const docId = btn.getAttribute('data-doc'); // this is room ID
                try {
                    let rIds = [];
                    const rSaved = localStorage.getItem('bedrock_saved_rooms');
                    if (rSaved) rIds = JSON.parse(rSaved);
                    rIds = rIds.filter(id => id !== docId);
                    localStorage.setItem('bedrock_saved_rooms', JSON.stringify(rIds));

                    syncSavedItem('room', docId, 'remove');

                    this.savedRooms = this.savedRooms.filter(d => d.$id !== docId);
                    this.renderContent();
                } catch (err) {
                    console.error(err);
                }
            });
        });
    }
}
