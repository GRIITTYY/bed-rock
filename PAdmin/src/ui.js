import { databases, DB_ID, COLL_BUILDING, COLL_ROOM, COLL_BOOKING, COLL_REVIEW, Query } from './appwrite.js';
import { getCurrentPAdmin } from './auth.js';
import { openEditBuildingModal, openNewRoomModal, openMultipleRoomsModal, openEditRoomModal, openBookingsModal, openReviewsModal, openDuplicateBuildingModal } from './modals.js';

export async function renderDashboard() {
  const admin = getCurrentPAdmin();
  if (!admin) return;

  const listEl = document.getElementById('building-list');
  listEl.innerHTML = '<p>Loading buildings...</p>';

  try {
    const res = await databases.listDocuments(DB_ID, COLL_BUILDING, [
      Query.equal('PAdmin', admin.$id)
    ]);
    
    listEl.innerHTML = '';
    if (res.documents.length === 0) {
      listEl.innerHTML = '<p>No buildings found. Add one to get started.</p>';
      return;
    }

    // We need to fetch rooms for each building to calculate average rating
    // But for demo simplicity, we can fetch rooms, then bookings, then reviews.
    // Given Appwrite relations, we can manually aggregate or mock it for now.
    
    for (const bldg of res.documents) {
      const card = document.createElement('div');
      card.className = 'glass-card building-card';
      
      const imgUrl = (bldg.Pictures && bldg.Pictures.length > 0) ? bldg.Pictures[0] : 'https://via.placeholder.com/400x200?text=No+Image';
      
      let avgRating = await calculateBuildingRating(bldg.$id);

      card.innerHTML = `
        <img src="${imgUrl}" class="bldg-card-img" alt="${bldg.Name}">
        <div class="bldg-card-info">
          <h3 class="bldg-card-title">${bldg.Name}</h3>
          <div class="bldg-card-meta">
            <span>Rating: ${avgRating} ⭐</span>
            <span>Type: ${bldg.Type}</span>
          </div>
          <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.4;">
            ${bldg.Details && bldg.Details.trim() ? bldg.Details : '<i>No details added yet.</i>'}
          </div>
          <div class="bldg-actions-grid">
            <button class="btn-success btn-manage-rooms" data-id="${bldg.$id}" title="Manage Rooms">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
              <span>Manage</span>
            </button>
            <button class="btn-white btn-edit-bldg" data-id="${bldg.$id}" title="Edit Building">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
              <span>Edit</span>
            </button>
            <button class="btn-grey btn-duplicate-bldg" data-id="${bldg.$id}" title="Duplicate Building">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
              <span>Duplicate</span>
            </button>
            <button class="btn-danger btn-delete-bldg" data-id="${bldg.$id}" title="Delete Building">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
              <span>Delete</span>
            </button>
          </div>
        </div>
      `;

      card.querySelector('.bldg-card-img').addEventListener('click', () => {
        openLightboxGallery(bldg.Pictures || []);
      });
      card.querySelector('.btn-manage-rooms').addEventListener('click', () => {
        window.location.hash = '#/building/' + bldg.$id;
      });
      card.querySelector('.bldg-card-title').addEventListener('click', () => {
        window.location.hash = '#/building/' + bldg.$id;
      });
      card.querySelector('.btn-edit-bldg').addEventListener('click', () => openEditBuildingModal(bldg));
      card.querySelector('.btn-duplicate-bldg').addEventListener('click', () => openDuplicateBuildingModal(bldg));
      card.querySelector('.btn-delete-bldg').addEventListener('click', () => deleteBuilding(bldg.$id));

      listEl.appendChild(card);
    }

  } catch (err) {
    console.error(err);
    listEl.innerHTML = '<p class="error-msg">Failed to load buildings.</p>';
  }
}

export async function renderBuildingPage(buildingId) {
  try {
    const bldg = await databases.getDocument(DB_ID, COLL_BUILDING, buildingId);
    
    document.getElementById('bldg-name').textContent = bldg.Name;
    document.getElementById('bldg-address').textContent = bldg.Address;

    const detailsContainer = document.getElementById('bldg-details-container');
    const detailsText = document.getElementById('bldg-details-text');
    detailsContainer.style.display = 'block';
    if (bldg.Details && bldg.Details.trim().length > 0) {
      detailsText.textContent = bldg.Details;
      detailsText.style.fontStyle = 'normal';
    } else {
      detailsText.textContent = 'No details provided yet.';
      detailsText.style.fontStyle = 'italic';
      detailsText.style.opacity = '0.7';
    }
    
    const imgEl = document.getElementById('bldg-img');
    const imgUrl = (bldg.Pictures && bldg.Pictures.length > 0) ? bldg.Pictures[0] : 'https://via.placeholder.com/400x200?text=No+Image';
    imgEl.src = imgUrl;
    imgEl.style.cursor = 'pointer';
    imgEl.onclick = () => {
      openLightboxGallery(bldg.Pictures || []);
    };
    
    document.getElementById('btn-edit-building').onclick = () => openEditBuildingModal(bldg);
    document.getElementById('btn-delete-building').onclick = () => {
      deleteBuilding(bldg.$id);
      window.location.hash = '#/dashboard';
    };

    document.getElementById('btn-add-room').onclick = () => openNewRoomModal(buildingId);
    document.getElementById('btn-add-multiple-rooms').onclick = () => openMultipleRoomsModal(buildingId);

    const roomsSection = document.getElementById('rooms-section');
    const hallBookingsBtn = document.getElementById('btn-view-hall-bookings');
    
    if (bldg.Type === 'Hall') {
      roomsSection.style.display = 'none';
      hallBookingsBtn.style.display = 'inline-block';
      hallBookingsBtn.onclick = () => openBookingsModal(bldg.$id, true);
    } else {
      roomsSection.style.display = 'block';
      hallBookingsBtn.style.display = 'none';
      // Fetch and render rooms
      renderRoomsList(buildingId);
    }

  } catch (err) {
    console.error(err);
    alert('Failed to load building details');
  }
}

export async function renderRoomsList(buildingId) {
  const listEl = document.getElementById('room-list');
  listEl.innerHTML = '<p>Loading rooms...</p>';

  try {
    const res = await databases.listDocuments(DB_ID, COLL_ROOM, [
      Query.equal('Building', buildingId)
    ]);
    
    // Sort by booking status (Not Booked first, then Booked). We calculate status per room.
    const roomsWithStatus = await Promise.all(res.documents.map(async room => {
      const { isBooked, activeBooking } = await checkRoomBookingStatus(room.$id);
      const avgRating = await getRoomAverageRating(room.$id);
      return { ...room, isBooked, activeBooking, avgRating };
    }));

    roomsWithStatus.sort((a, b) => a.isBooked === b.isBooked ? 0 : a.isBooked ? 1 : -1);

    listEl.innerHTML = '';
    if (roomsWithStatus.length === 0) {
      listEl.innerHTML = '<p>No rooms found. Add some to begin.</p>';
      return;
    }

    roomsWithStatus.forEach(room => {
      const item = document.createElement('div');
      item.className = 'room-item';
      
      const statusClass = room.isBooked ? 'status-booked' : 'status-not-booked';
      const statusText = room.isBooked ? 'Booked' : 'Not Booked';

      item.innerHTML = `
        <div class="room-item-info">
          <h3>${room.RoomName}</h3>
          <span class="room-item-status ${statusClass}">${statusText}</span>
          <div style="margin-top: 0.5rem">
            <select class="room-status-select" data-id="${room.$id}">
              <option value="Open" ${room.Status === 'Open' ? 'selected' : ''}>Open</option>
              <option value="Closed" ${room.Status === 'Closed' ? 'selected' : ''}>Closed</option>
            </select>
          </div>
        </div>
        <div class="room-item-actions">
          <button class="btn-primary btn-view-bookings" data-id="${room.$id}" title="View Bookings">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
            <span>Bookings</span>
          </button>
          <button class="btn-info btn-view-reviews" data-id="${room.$id}" title="Reviews: ${room.avgRating}" ${room.avgRating === 'No Reviews' ? 'disabled' : ''}>
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path></svg>
            <span>${room.avgRating === 'No Reviews' ? 'No Reviews' : room.avgRating}</span>
          </button>
          <button class="btn-secondary btn-edit-room" data-id="${room.$id}" title="Edit Room">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
            <span>Edit</span>
          </button>
        </div>
      `;

      item.querySelector('.room-status-select').addEventListener('change', async (e) => {
        try {
          await databases.updateDocument(DB_ID, COLL_ROOM, room.$id, { Status: e.target.value });
        } catch (err) {
          console.error(err);
          alert('Failed to update status');
        }
      });

      item.querySelector('.btn-view-bookings').addEventListener('click', () => openBookingsModal(room.$id));
      item.querySelector('.btn-view-reviews').addEventListener('click', () => openReviewsModal(room.$id));
      item.querySelector('.btn-edit-room').addEventListener('click', () => openEditRoomModal(room));

      listEl.appendChild(item);
    });

  } catch (err) {
    console.error(err);
    listEl.innerHTML = '<p class="error-msg">Failed to load rooms.</p>';
  }
}

// Helpers
async function calculateBuildingRating(buildingId) {
  try {
    const rooms = await databases.listDocuments(DB_ID, COLL_ROOM, [Query.equal('Building', buildingId)]);
    if (rooms.documents.length === 0) return "No Reviews";
    
    const roomIds = rooms.documents.map(r => r.$id);
    const bookings = await databases.listDocuments(DB_ID, COLL_BOOKING, []); 
    const relevantBookings = bookings.documents.filter(b => {
      const rid = b.Room && b.Room.$id ? b.Room.$id : b.Room;
      return roomIds.includes(rid);
    });
    if (relevantBookings.length === 0) return "No Reviews";

    const bookingIds = relevantBookings.map(b => b.$id);
    const reviews = await databases.listDocuments(DB_ID, COLL_REVIEW, []);
    const relevantReviews = reviews.documents.filter(r => {
      const bid = r.Booking && r.Booking.$id ? r.Booking.$id : r.Booking;
      return bookingIds.includes(bid);
    });
    if (relevantReviews.length === 0) return "No Reviews";

    let total = 0;
    relevantReviews.forEach(r => total += r.Rating);
    return (total / relevantReviews.length).toFixed(1);
  } catch(e) {
    console.error('Error calculating rating:', e);
    return "No Reviews";
  }
}

async function checkRoomBookingStatus(roomId) {
  try {
    const res = await databases.listDocuments(DB_ID, COLL_BOOKING, [
      Query.equal('Room', roomId)
    ]);
    const now = new Date();
    for (const b of res.documents) {
      const start = new Date(b.StartDate);
      const end = new Date(b.EndDate);
      if (now >= start && now <= end) {
        return { isBooked: true, activeBooking: b };
      }
    }
  } catch(e) {}
  return { isBooked: false, activeBooking: null };
}

async function getRoomAverageRating(roomId) {
  try {
    const bookings = await databases.listDocuments(DB_ID, COLL_BOOKING, [Query.equal('Room', roomId)]);
    if (bookings.documents.length === 0) return "No Reviews";

    const bookingIds = bookings.documents.map(b => b.$id);
    const reviews = await databases.listDocuments(DB_ID, COLL_REVIEW, []);
    const relevantReviews = reviews.documents.filter(r => {
      const bid = r.Booking && r.Booking.$id ? r.Booking.$id : r.Booking;
      return bookingIds.includes(bid);
    });
    
    if (relevantReviews.length === 0) return "No Reviews";

    let total = 0;
    relevantReviews.forEach(r => total += r.Rating);
    return (total / relevantReviews.length).toFixed(1);
  } catch(e) {
    console.error('Error calculating room rating:', e);
    return "No Reviews";
  }
}

// Removed duplicateBuilding from here, it is now handled via openDuplicateBuildingModal in modals.js

async function deleteBuilding(id) {
  if (!confirm('Are you sure you want to delete this building?')) return;
  try {
    await databases.deleteDocument(DB_ID, COLL_BUILDING, id);
    if (window.location.hash.startsWith('#/dashboard')) renderDashboard();
  } catch(err) {
    console.error(err);
    alert('Failed to delete');
  }
}

// --- Lightbox Gallery Logic ---
let lightboxImages = [];
let lightboxCurrentIndex = 0;

function updateLightboxImage() {
  if (lightboxImages.length === 0) return;
  const imgEl = document.getElementById('lightbox-img');
  let url = lightboxImages[lightboxCurrentIndex];
  if (url.includes('appwrite.io') && !url.includes('project=')) {
      url += (url.includes('?') ? '&' : '?') + 'project=bedrock';
  }
  imgEl.src = url;
  const counterEl = document.getElementById('lightbox-counter');
  if (counterEl) {
    counterEl.textContent = `${lightboxCurrentIndex + 1} / ${lightboxImages.length}`;
  }
}

export function openLightboxGallery(pictures) {
  lightboxImages = pictures && pictures.length > 0 ? pictures : ['https://via.placeholder.com/800x600?text=No+Image'];
  lightboxCurrentIndex = 0;
  updateLightboxImage();
  const modal = document.getElementById('modal-lightbox');
  if (modal) modal.showModal();
}

document.getElementById('lightbox-prev')?.addEventListener('click', (e) => {
  e.stopPropagation();
  if (lightboxImages.length <= 1) return;
  lightboxCurrentIndex = (lightboxCurrentIndex - 1 + lightboxImages.length) % lightboxImages.length;
  updateLightboxImage();
});

document.getElementById('lightbox-next')?.addEventListener('click', (e) => {
  e.stopPropagation();
  if (lightboxImages.length <= 1) return;
  lightboxCurrentIndex = (lightboxCurrentIndex + 1) % lightboxImages.length;
  updateLightboxImage();
});

let touchstartX = 0;
let touchendX = 0;
const lightboxModal = document.getElementById('modal-lightbox');
lightboxModal?.addEventListener('touchstart', e => {
  touchstartX = e.changedTouches[0].screenX;
});
lightboxModal?.addEventListener('touchend', e => {
  touchendX = e.changedTouches[0].screenX;
  if (touchstartX - touchendX > 50) { // Swipe left (next)
    if (lightboxImages.length <= 1) return;
    lightboxCurrentIndex = (lightboxCurrentIndex + 1) % lightboxImages.length;
    updateLightboxImage();
  } else if (touchendX - touchstartX > 50) { // Swipe right (prev)
    if (lightboxImages.length <= 1) return;
    lightboxCurrentIndex = (lightboxCurrentIndex - 1 + lightboxImages.length) % lightboxImages.length;
    updateLightboxImage();
  }
});
