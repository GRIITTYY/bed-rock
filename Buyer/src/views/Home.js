import { databases, DB_ID, COL_BUILDING } from '../appwrite.js';

export default class Home {
    constructor() {
        document.title = "Bedrock | Home";
        this.buildings = [];
    }

    async render() {
        return `
            <div style="text-align: center; padding: 4rem 1rem; background: linear-gradient(135deg, rgba(37,99,235,0.05) 0%, rgba(37,99,235,0) 100%); border-radius: 1rem; margin-bottom: 3rem;">
                <h1 style="font-size: 3.5rem; margin-bottom: 1rem; color: var(--accent); font-weight: 800; letter-spacing: -1px;">Welcome to Bedrock</h1>
                <p style="font-size: 1.25rem; color: var(--text-secondary); max-width: 650px; margin: 0 auto 2.5rem; line-height: 1.6;">
                    The centralized accommodation procurement platform for Redemption City. 
                    Browse live unit listings and book instantly with no waiting period.
                </p>
                <div style="display: flex; gap: 1rem; justify-content: center;">
                    <a href="/login" class="btn" style="font-size: 1.1rem; padding: 0.8rem 2rem;" data-link>Get Started</a>
                    <a href="/catalogue" class="btn" style="background: transparent; border: 1px solid var(--accent); color: var(--accent); font-size: 1.1rem; padding: 0.8rem 2rem;" data-link>Browse Catalog</a>
                </div>
            </div>

            <h2 style="font-size: 2rem; margin-bottom: 2rem; color: var(--text-primary); text-align: center;">Featured Accommodations</h2>
            <div id="featured-buildings" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 2rem; margin-bottom: 3rem;">
                <div style="text-align: center; grid-column: 1 / -1; padding: 2rem;">Loading featured buildings...</div>
            </div>
            <div style="text-align: center; margin-bottom: 4rem;">
                <a href="/catalogue" class="btn" style="padding: 0.75rem 3rem;" data-link>View All Buildings</a>
            </div>
        `;
    }

    async mounted() {
        try {
            const response = await databases.listDocuments(DB_ID, COL_BUILDING);
            let allBuildings = response.documents;
            
            // Randomly select up to 5 buildings
            const shuffled = allBuildings.sort(() => 0.5 - Math.random());
            this.buildings = shuffled.slice(0, 5);

            this.renderFeatured();
        } catch (err) {
            console.error("Failed to load featured buildings", err);
            document.getElementById('featured-buildings').innerHTML = `<div style="color:var(--danger); grid-column: 1 / -1; text-align: center;">Failed to load featured buildings.</div>`;
        }
    }

    renderFeatured() {
        const grid = document.getElementById('featured-buildings');
        if (this.buildings.length === 0) {
            grid.innerHTML = `<div style="text-align:center; grid-column: 1 / -1;">No buildings currently available.</div>`;
            return;
        }

        grid.innerHTML = this.buildings.map(building => {
            let imgUrl = (building.Pictures && building.Pictures.length > 0) ? building.Pictures[0] : 'https://via.placeholder.com/400x300?text=No+Image';
            if (imgUrl.includes('appwrite.io') && !imgUrl.includes('project=')) {
                imgUrl += (imgUrl.includes('?') ? '&' : '?') + 'project=bedrock';
            }
            return `
                <div class="card" style="padding: 0; cursor: pointer; display: flex; flex-direction: column; transition: transform 0.2s, box-shadow 0.2s;" data-id="${building.$id}" onclick="window.history.pushState(null, null, '/building/${building.$id}'); window.dispatchEvent(new Event('popstate'));">
                    <div class="gallery-trigger" data-pictures="${JSON.stringify(building.Pictures || []).replace(/"/g, '&quot;')}" style="height: 200px; background: url('${imgUrl}') center/cover; border-radius: 0.75rem 0.75rem 0 0;" title="Click to view all pictures"></div>
                    <div style="padding: 1.5rem; flex: 1;">
                        <h3 style="color: var(--accent); margin-bottom: 0.5rem; font-size: 1.25rem;">${building.Name || 'Unnamed Building'}</h3>
                        <p style="color: var(--text-secondary); margin-bottom: 0.5rem; font-size: 0.95rem;">${building.Type || 'Unknown Type'}</p>
                        <p style="font-size: 0.9rem; color: var(--text-secondary);">${building.Address || ''}</p>
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
