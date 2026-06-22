import { databases, DB_ID, COL_BUILDING, COL_ROOM, COL_BOOKING, syncSavedItem } from '../appwrite.js';
import { navigateTo } from '../main.js';

export default class Catalogue {
    constructor() {
        document.title = "Bedrock | Catalogue";
        document.title = "Bedrock | Catalogue";
        this.buildings = [];
        this.filteredBuildings = [];
        this.savedBuildingIds = [];
        this.savedDocs = {}; // map buildingId -> savedBuilding doc id
        this.activeFilters = {
            name: '',
            type: '',
            leasing: '',
            minPrice: null,
            maxPrice: null,
            beds: null,
            baths: null,
            occupants: null
        };
    }

    async render() {
        return `
            <div>
                <div style="display: flex; gap: 1rem; margin-bottom: 2rem; align-items: center; flex-wrap: wrap;">
                    <input type="text" id="search-input" placeholder="Search buildings by Name or Address..." style="flex: 1; min-width: 200px; margin-bottom: 0;" />
                    
                    <select id="inline-filter-type" style="width: auto; margin-bottom: 0;">
                        <option value="">All Types</option>
                        <option value="Hostel">Hostel</option>
                        <option value="Hotel">Hotel</option>
                        <option value="Hall">Hall</option>
                        <option value="Apartment">Apartment</option>
                    </select>

                    <select id="inline-filter-leasing" style="width: auto; margin-bottom: 0;">
                        <option value="">All Leasing Periods</option>
                        <option value="daily">Daily</option>
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                    </select>

                    <button id="btn-filter" class="btn" style="background: var(--bg-secondary); border: 1px solid var(--glass-border); color: var(--text-primary);">More Filters</button>
                    <button id="btn-sort" class="btn" style="background: var(--bg-secondary); border: 1px solid var(--glass-border); color: var(--text-primary);">Sort</button>
                    <button id="btn-clear-filters" class="btn" style="background: transparent; border: 1px solid var(--danger); color: var(--danger);">Clear</button>
                </div>
                <div id="buildings-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 2rem;">
                    <div style="text-align:center; grid-column: 1 / -1;">Loading buildings...</div>
                </div>
            </div>
        `;
    }

    async mounted() {
        // Load persisted filters
        const savedFilters = localStorage.getItem('bedrock_catalogue_filters');
        if (savedFilters) {
            try {
                this.activeFilters = JSON.parse(savedFilters);
            } catch(e) {}
        }

        // Hydrate inline UI with persisted state
        document.getElementById('search-input').value = this.activeFilters.name || '';
        document.getElementById('inline-filter-type').value = this.activeFilters.type || '';
        document.getElementById('inline-filter-leasing').value = this.activeFilters.leasing || '';

        await this.loadBuildings();
        
        // Input listeners for immediate filtering
        const triggerFilter = () => {
            this.activeFilters.name = document.getElementById('search-input').value.toLowerCase();
            this.activeFilters.type = document.getElementById('inline-filter-type').value;
            this.activeFilters.leasing = document.getElementById('inline-filter-leasing').value;
            this.applyFilter(this.activeFilters);
        };

        document.getElementById('search-input').addEventListener('input', triggerFilter);
        document.getElementById('inline-filter-type').addEventListener('change', triggerFilter);
        document.getElementById('inline-filter-leasing').addEventListener('change', triggerFilter);

        document.getElementById('btn-clear-filters').addEventListener('click', () => {
            this.activeFilters = {
                name: '', type: '', leasing: '',
                minPrice: null, maxPrice: null, beds: null, baths: null, occupants: null
            };
            document.getElementById('search-input').value = '';
            document.getElementById('inline-filter-type').value = '';
            document.getElementById('inline-filter-leasing').value = '';
            this.applyFilter(this.activeFilters);
        });

        document.getElementById('btn-filter').addEventListener('click', () => {
            // Open Filter Modal
            import('../components/Modals.js').then(m => m.openFilterModal(this, this.activeFilters));
        });

        document.getElementById('btn-sort').addEventListener('click', () => {
            // Open Sort Modal
            import('../components/Modals.js').then(m => m.openSortModal(this));
        });
    }

    async loadBuildings() {
        try {
            // For a production app, we would handle pagination. Here we just fetch first 100
            const response = await databases.listDocuments(DB_ID, COL_BUILDING);
            this.buildings = response.documents;
            
            // To support sorting by availability/price/rating, we need rooms data
            // Fetch rooms for all these buildings
            const roomsResponse = await databases.listDocuments(DB_ID, COL_ROOM);
            const rooms = roomsResponse.documents;
            
            // Read saved buildings from localStorage
            this.savedBuildingIds = [];
            try {
                const saved = localStorage.getItem('bedrock_saved_buildings');
                if (saved) {
                    this.savedBuildingIds = JSON.parse(saved);
                }
            } catch (e) {
                console.warn("Failed to parse saved buildings from localStorage");
            }
            
            // Explicitly fetch Bookings since Appwrite may not populate relationships for guests
            let allBookings = [];
            try {
                const { Query } = await import('appwrite');
                const bookingsResponse = await databases.listDocuments(DB_ID, COL_BOOKING, [
                    Query.limit(1000)
                ]);
                allBookings = bookingsResponse.documents;
            } catch (e) {
                console.warn("Could not fetch bookings in catalogue", e);
            }
            
            this.buildings.forEach(building => {
                building.cachedRooms = rooms.filter(r => {
                    const bId = (typeof r.Building === 'object' && r.Building !== null) ? r.Building.$id : r.Building;
                    return bId === building.$id && r.Status !== 'Closed';
                });
                // Calculate Availability
                let availableCount = 0;
                let totalPrice = 0;
                
                const now = new Date();
                building.cachedRooms.forEach(room => {
                    let isBooked = false;
                    const roomBookings = allBookings.filter(b => {
                        const bRoomId = typeof b.Room === 'object' && b.Room !== null ? b.Room.$id : b.Room;
                        return bRoomId === room.$id;
                    });
                    
                    if (roomBookings.length > 0) {
                        isBooked = roomBookings.some(booking => {
                            const start = new Date(booking.StartDate);
                            const end = new Date(booking.EndDate);
                            return now >= start && now <= end;
                        });
                    }
                    if (!isBooked) {
                        availableCount++;
                        totalPrice += room.RoomPrice || 0;
                    }
                });
                
                building.availableRoomsCount = availableCount;
                building.averageAvailablePrice = availableCount > 0 ? (totalPrice / availableCount) : 0;
            });

            this.filteredBuildings = [...this.buildings];
            // Apply existing filters automatically on load
            this.applyFilter(this.activeFilters);
        } catch (err) {
            console.error("Failed to load buildings", err);
            document.getElementById('buildings-grid').innerHTML = `<div style="color:var(--danger);">Failed to load buildings.</div>`;
        }
    }

    renderGrid() {
        const grid = document.getElementById('buildings-grid');
        if (this.filteredBuildings.length === 0) {
            grid.innerHTML = `<div style="text-align:center; grid-column: 1 / -1;">No buildings found.</div>`;
            return;
        }

        grid.innerHTML = this.filteredBuildings.map(building => {
            let imgUrl = (building.Pictures && building.Pictures.length > 0) ? building.Pictures[0] : 'https://via.placeholder.com/400x300?text=No+Image';
            if (imgUrl.includes('appwrite.io') && !imgUrl.includes('project=')) {
                imgUrl += (imgUrl.includes('?') ? '&' : '?') + 'project=bedrock';
            }
            const isSaved = this.savedBuildingIds.includes(building.$id);
            const heartIcon = isSaved ? 
                `<svg fill="currentColor" viewBox="0 0 24 24" width="24" height="24" style="color: var(--danger);"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path></svg>` : 
                `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="24" height="24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>`;

            return `
                <div class="card" style="padding: 0; cursor: pointer; display: flex; flex-direction: column; position: relative;" data-id="${building.$id}">
                    <div class="gallery-trigger" data-pictures="${JSON.stringify(building.Pictures || []).replace(/"/g, '&quot;')}" style="height: 200px; background: url('${imgUrl}') center/cover; border-radius: 0.75rem 0.75rem 0 0;" title="Click to view all pictures"></div>
                    <button class="like-btn" data-id="${building.$id}" data-saved="${isSaved}" style="position: absolute; top: 10px; right: 10px; background: rgba(0,0,0,0.5); border: none; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; color: white; cursor: pointer; transition: transform 0.2s;">
                        ${heartIcon}
                    </button>
                    <div style="padding: 1.5rem; flex: 1;">
                        <h3 style="color: var(--accent); margin-bottom: 0.5rem; font-size: 1.25rem;">${building.Name || 'Unnamed Building'}</h3>
                        <p style="color: var(--text-secondary); margin-bottom: 0.5rem;">${building.Type || 'Unknown Type'}</p>
                        <p style="font-size: 0.9rem;">Available Rooms: <span style="font-weight:bold; color: ${building.availableRoomsCount > 0 ? 'var(--success)' : 'var(--danger)'};">${building.availableRoomsCount}</span></p>
                        <p style="font-size: 1.1rem; color: var(--accent); font-weight: 600; margin-top: 0.5rem;">
                            ${building.availableRoomsCount > 0 ? `₦${Math.round(building.averageAvailablePrice).toLocaleString()} <span style="font-size: 0.8rem; opacity: 0.8; font-weight: 400; color: var(--text-secondary);">/ ${building.LeasingPeriod || 'period'}</span>` : '<span style="color:var(--text-secondary); font-size: 0.9rem;">No Rooms Available</span>'}
                        </p>
                    </div>
                </div>
            `;
        }).join('');

        grid.querySelectorAll('.card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.gallery-trigger') || e.target.closest('.like-btn')) return; // handled separately
                navigateTo(`/building/${card.getAttribute('data-id')}`);
            });
        });

        grid.querySelectorAll('.like-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                try {
                    const buildingId = btn.getAttribute('data-id');
                    const isSaved = btn.getAttribute('data-saved') === 'true';
                    
                    // Update State
                    const newSavedState = !isSaved;
                    btn.setAttribute('data-saved', newSavedState.toString());
                    btn.innerHTML = newSavedState ? 
                        `<svg fill="currentColor" viewBox="0 0 24 24" width="24" height="24" style="color: var(--danger);"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path></svg>` : 
                        `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="24" height="24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>`;
                    
                    // Update localStorage
                    let savedArray = [];
                    try {
                        const saved = localStorage.getItem('bedrock_saved_buildings');
                        if (saved) savedArray = JSON.parse(saved);
                    } catch(e) {}

                    if (newSavedState) {
                        if (!savedArray.includes(buildingId)) savedArray.push(buildingId);
                        this.savedBuildingIds.push(buildingId);
                        syncSavedItem('building', buildingId, 'add');
                    } else {
                        savedArray = savedArray.filter(id => id !== buildingId);
                        this.savedBuildingIds = this.savedBuildingIds.filter(id => id !== buildingId);
                        syncSavedItem('building', buildingId, 'remove');
                    }
                    localStorage.setItem('bedrock_saved_buildings', JSON.stringify(savedArray));

                } catch (err) {
                    console.error("Like toggle failed", err);
                }
            });
        });

        grid.querySelectorAll('.gallery-trigger').forEach(trigger => {
            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                import('../components/Modals.js').then(m => {
                    m.openLightboxGallery(JSON.parse(trigger.getAttribute('data-pictures')));
                });
            });
        });
    }

    applyFilter(filters) {
        // Save to local storage to persist
        this.activeFilters = { ...this.activeFilters, ...filters };
        localStorage.setItem('bedrock_catalogue_filters', JSON.stringify(this.activeFilters));

        const f = this.activeFilters;

        // Advanced search through Building and Room fields
        this.filteredBuildings = this.buildings.filter(b => {
            let match = true;
            if (f.name && !b.Name?.toLowerCase().includes(f.name) && !b.Address?.toLowerCase().includes(f.name)) match = false;
            if (f.type && b.Type !== f.type) match = false;
            if (f.leasing && b.LeasingPeriod !== f.leasing) match = false;
            
            // Check room filters if any
            if (f.minPrice || f.maxPrice || f.beds || f.baths || f.occupants) {
                const hasMatchingRoom = b.cachedRooms.some(r => {
                    let rMatch = true;
                    if (f.minPrice && r.RoomPrice < f.minPrice) rMatch = false;
                    if (f.maxPrice && r.RoomPrice > f.maxPrice) rMatch = false;
                    if (f.beds && r.NbrBeds < f.beds) rMatch = false;
                    if (f.baths && r.NbrBathrooms < f.baths) rMatch = false;
                    if (f.occupants && r.MaxOccupants < f.occupants) rMatch = false;
                    return rMatch;
                });
                if (!hasMatchingRoom) match = false;
            }
            return match;
        });
        this.renderGrid();
    }

    applySort(sortBy) {
        // Sorts: Availability, Alphabetical, Price, Rating
        this.filteredBuildings.sort((a, b) => {
            if (sortBy === 'availability') {
                return b.availableRoomsCount - a.availableRoomsCount;
            } else if (sortBy === 'alphabetical') {
                return (a.Name || '').localeCompare(b.Name || '');
            } else if (sortBy === 'price') {
                return a.averageAvailablePrice - b.averageAvailablePrice;
            } else if (sortBy === 'rating') {
                // To implement rating sort, we'd need to aggregate reviews from bookings.
                // Assuming we did that in loadBuildings or just sorting by 0 for now if not fetched.
                return (b.averageRating || 0) - (a.averageRating || 0);
            }
            return 0;
        });
        this.renderGrid();
    }
}
