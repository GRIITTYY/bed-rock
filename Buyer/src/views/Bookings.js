import { account, databases, DB_ID, COL_BOOKING, COL_BUILDING, COL_BUYER, COL_ROOM } from '../appwrite.js';
import { navigateTo } from '../main.js';

export default class Bookings {
    constructor() {
        document.title = "Bedrock | My Bookings";
        this.buyerId = null;
        this.bookings = [];
        this.featuredBuildings = [];
    }

    async render() {
        return `
            <div style="max-width: 1000px; margin: 0 auto; padding: 2rem 0;">
                <h1 style="color: var(--accent); margin-bottom: 2rem; font-size: 2.5rem;">My Dashboard</h1>
                
                <h2 style="margin-bottom: 1rem; font-size: 1.5rem; color: var(--text-primary);">Your Bookings</h2>
                <div id="bookings-container" class="card" style="margin-bottom: 3rem;">
                    <div style="text-align:center; padding: 2rem;">Loading bookings...</div>
                </div>

                <h2 style="margin-bottom: 1rem; font-size: 1.5rem; color: var(--text-primary);">Browse Accommodations</h2>
                <div id="featured-buildings" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
                    <div style="text-align:center; padding: 2rem; grid-column: 1 / -1;">Loading featured buildings...</div>
                </div>
                
                <div style="text-align: center; margin-bottom: 2rem;">
                    <a href="/catalogue" class="btn" style="padding: 0.75rem 3rem;" data-link>Browse Full Catalog</a>
                </div>
            </div>
        `;
    }

    async mounted() {
        try {
            const user = await account.get();
            let buyerId = user.prefs && user.prefs.buyerId;
            if (!buyerId) {
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
        } catch (err) {
            console.error("Bookings load error", err);
            navigateTo('/login');
        }
    }

    async loadData() {
        try {
            const { Query } = await import('appwrite');
            // Load bookings
            const bookingsRes = await databases.listDocuments(DB_ID, COL_BOOKING, [
                Query.equal('Buyer', this.buyerId),
                Query.orderDesc('$createdAt'),
                Query.limit(100)
            ]);
            this.bookings = bookingsRes.documents;
            
            // Hydrate nested relationships manually in case Appwrite returns just IDs
            for (let b of this.bookings) {
                if (typeof b.Room === 'string') {
                    try {
                        b.Room = await databases.getDocument(DB_ID, COL_ROOM, b.Room);
                    } catch(e) {}
                }
                if (b.Room && typeof b.Room.Building === 'string') {
                    try {
                        b.Room.Building = await databases.getDocument(DB_ID, COL_BUILDING, b.Room.Building);
                    } catch(e) {}
                }
                if (typeof b.Review === 'string') {
                    try {
                        b.Review = await databases.getDocument(DB_ID, COL_REVIEW, b.Review);
                    } catch(e) {}
                }
            }

            this.bookings.sort((a, b) => new Date(b.StartDate) - new Date(a.StartDate));
            
            this.renderBookings();

            // Load 5 random buildings
            const buildingsRes = await databases.listDocuments(DB_ID, COL_BUILDING);
            const allBuildings = buildingsRes.documents;
            
            // Load all rooms to accurately count them per building
            const roomsRes = await databases.listDocuments(DB_ID, COL_ROOM);
            const allRooms = roomsRes.documents;

            const shuffled = allBuildings.sort(() => 0.5 - Math.random());
            this.featuredBuildings = shuffled.slice(0, 5).map(b => {
                b.roomCount = allRooms.filter(r => r.Building && (r.Building.$id === b.$id || r.Building === b.$id)).length;
                return b;
            });

            this.renderFeaturedBuildings();
        } catch (err) {
            console.error("Failed to load dashboard data", err);
            document.getElementById('bookings-container').innerHTML = `<div style="color:var(--danger); padding:2rem;">Failed to load data.</div>`;
        }
    }

    renderBookings() {
        const container = document.getElementById('bookings-container');
        
        if (this.bookings.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 3rem 1rem;">
                    <h3 style="margin-bottom: 1rem; color: var(--text-primary);">You have no bookings yet.</h3>
                    <p style="color: var(--text-secondary); margin-bottom: 2rem;">Find the perfect room and secure it instantly!</p>
                    <a href="/catalogue" class="btn" data-link>Create Booking</a>
                </div>
            `;
            return;
        }

        const tableRows = this.bookings.map(b => {
            const roomName = b.Room ? b.Room.RoomName : 'Unknown Room';
            const buildingName = (b.Room && b.Room.Building) ? b.Room.Building.Name : 'Unknown Building';
            const buildingId = (b.Room && b.Room.Building) ? b.Room.Building.$id : null;
            const start = new Date(b.StartDate).toLocaleDateString();
            const end = new Date(b.EndDate).toLocaleDateString();
            
            const bLink = buildingId ? `<a href="/building/${buildingId}" data-link style="color: var(--accent); text-decoration: underline; font-weight: 500;">${buildingName}</a>` : buildingName;
            const rLink = (buildingId && b.Room) ? `<a href="/building/${buildingId}#room-${b.Room.$id}" data-link style="color: var(--text-primary); text-decoration: underline;">${roomName}</a>` : roomName;
            
            const startObj = new Date(b.StartDate);
            const endObj = new Date(b.EndDate);
            const now = new Date();
            
            let statusBadge = '';
            if (now < startObj) {
                const diffTime = Math.abs(startObj - now);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                statusBadge = `<div style="margin-top:0.25rem;"><span style="font-size:0.75rem; background:var(--accent); color:white; padding:0.1rem 0.4rem; border-radius:4px; font-weight:600;">Starts in ${diffDays} day${diffDays!==1?'s':''}</span></div>`;
            } else if (now >= startObj && now <= endObj) {
                const diffTime = Math.abs(endObj - now);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                statusBadge = `<div style="margin-top:0.25rem;"><span style="font-size:0.75rem; background:var(--success); color:white; padding:0.1rem 0.4rem; border-radius:4px; font-weight:600;">${diffDays} day${diffDays!==1?'s':''} left</span></div>`;
            } else {
                statusBadge = `<div style="margin-top:0.25rem;"><span style="font-size:0.75rem; background:transparent; border:1px solid var(--glass-border); color:var(--text-secondary); padding:0.1rem 0.4rem; border-radius:4px; font-weight:600;">Completed</span></div>`;
            }
            
            const hasReviewed = !!b.Review;
            const canReviewDate = startObj;
            const canReview = now >= canReviewDate;
            
            let actionHtml = '';
            if (hasReviewed) {
                actionHtml = `<button class="btn btn-sm" style="background:transparent; border: 1px solid var(--success); color:var(--success); padding: 0.4rem 0.8rem; opacity: 0.8; cursor: not-allowed; min-width: 120px;" disabled>Reviewed</button>`;
            } else if (!canReview) {
                actionHtml = `<button class="btn btn-sm" title="Review available on ${canReviewDate.toLocaleDateString()}" style="background:var(--bg-color); border: 1px solid var(--glass-border); color:var(--text-secondary); padding: 0.4rem 0.8rem; opacity: 0.7; cursor: not-allowed; min-width: 120px;" disabled>Review later</button>`;
            } else {
                actionHtml = `<button class="btn btn-sm btn-review" data-id="${b.$id}" style="background:var(--bg-secondary); border: 1px solid var(--glass-border); color:var(--text-primary); padding: 0.4rem 0.8rem; min-width: 120px;">Review</button>`;
            }
            
            return `
                <div style="display: flex; flex-wrap: wrap; gap: 1rem; justify-content: space-between; align-items: center; padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--glass-border);">
                    <div style="flex: 2; min-width: 200px;">
                        <h4 style="margin-bottom: 0.25rem; font-size: 1.1rem; display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                            ${bLink} <span style="color:var(--text-secondary); font-size:0.9rem;">&bull;</span> ${rLink}
                        </h4>
                        <div style="font-weight:500; font-size: 0.95rem; margin-top: 0.5rem; color: var(--text-secondary);">${start} - ${end}</div>
                    </div>
                    <div style="flex: 1; min-width: 120px;">
                        ${statusBadge}
                    </div>
                    <div style="display: flex; justify-content: flex-end;">
                        ${actionHtml}
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = `
            <div style="background: var(--bg-color); border: 1px solid var(--glass-border); border-radius: 0.75rem; overflow: hidden; margin-bottom: 2rem;">
                ${tableRows}
            </div>
        `;

        import('../components/Modals.js').then(m => {
            container.querySelectorAll('.btn-review').forEach(btn => {
                btn.addEventListener('click', () => {
                    const booking = this.bookings.find(bk => bk.$id === btn.getAttribute('data-id'));
                    m.openAddReviewModal(booking);
                });
            });
        });
    }

    renderFeaturedBuildings() {
        const grid = document.getElementById('featured-buildings');
        
        if (this.featuredBuildings.length === 0) {
            grid.innerHTML = `<div style="text-align:center; grid-column: 1 / -1;">No buildings currently available.</div>`;
            return;
        }

        grid.innerHTML = this.featuredBuildings.map(building => {
            let imgUrl = (building.Pictures && building.Pictures.length > 0) ? building.Pictures[0] : 'https://via.placeholder.com/400x300?text=No+Image';
            if (imgUrl.includes('appwrite.io') && !imgUrl.includes('project=')) {
                imgUrl += (imgUrl.includes('?') ? '&' : '?') + 'project=bedrock';
            }
            
            // Use the dynamically calculated room count
            const roomCount = building.roomCount || 0;

            return `
                <div class="card" style="padding: 0; cursor: pointer; display: flex; flex-direction: column;" data-id="${building.$id}" onclick="window.history.pushState(null, null, '/building/${building.$id}'); window.dispatchEvent(new Event('popstate'));">
                    <div class="gallery-trigger" data-pictures="${JSON.stringify(building.Pictures || []).replace(/"/g, '&quot;')}" style="height: 160px; background: url('${imgUrl}') center/cover; border-radius: 0.75rem 0.75rem 0 0;" title="Click to view all pictures"></div>
                    <div style="padding: 1.2rem; flex: 1;">
                        <h3 style="color: var(--accent); margin-bottom: 0.25rem; font-size: 1.2rem;">${building.Name || 'Unnamed Building'}</h3>
                        <p style="color: var(--text-secondary); margin-bottom: 0.5rem; font-size: 0.9rem;">${building.Type || 'Unknown Type'}</p>
                        <p style="font-size: 0.9rem; margin-bottom: 0.5rem;">${building.Address || ''}</p>
                        <p style="font-size: 0.85rem; font-weight: bold; color: var(--success);">Total Rooms: ${roomCount}</p>
                    </div>
                </div>
            `;
        }).join('');

        grid.querySelectorAll('.gallery-trigger').forEach(trigger => {
            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                import('../components/Modals.js').then(m => {
                    m.openLightboxGallery(JSON.parse(trigger.getAttribute('data-pictures')));
                });
            });
        });
    }
}
