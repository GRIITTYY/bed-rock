import { databases, storage, DB_ID, COLL_BUILDING, COLL_ROOM, COLL_BOOKING, COLL_REVIEW, BUCKET_ID, Query, ID } from './appwrite.js';
import { getCurrentPAdmin } from './auth.js';
import { renderDashboard, renderRoomsList } from './ui.js';
import { Calendar } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';

let currentBuildingId = null;
let currentRoomId = null;
let isEditMode = false;
let duplicateSourceBuildingId = null;
let currentPictures = [];
let pendingUploads = [];
let previewUrls = [];

function renderPicturePreviews() {
  const container = document.getElementById('bldg-current-pics');
  const counter = document.getElementById('bldg-pic-counter');
  if (!container) return;
  container.innerHTML = '';
  
  const allPreviews = [
    ...currentPictures.map((url, i) => ({ type: 'current', url, index: i })),
    ...previewUrls.map((url, i) => ({ type: 'pending', url, index: i }))
  ];

  if (counter) {
    counter.style.display = allPreviews.length > 0 ? 'block' : 'none';
    counter.textContent = `${allPreviews.length} Picture${allPreviews.length === 1 ? '' : 's'} Added`;
  }
  
  allPreviews.forEach((item) => {
    const div = document.createElement('div');
    div.className = 'pic-preview-item';
    div.innerHTML = `
      <img src="${item.url}" alt="Preview" style="cursor: pointer;" onclick="document.getElementById('lightbox-img').src=this.src; document.getElementById('modal-lightbox').showModal();">
      <button type="button" class="btn-remove-pic">×</button>
    `;
    div.querySelector('.btn-remove-pic').addEventListener('click', () => {
      if (item.type === 'current') {
        currentPictures.splice(item.index, 1);
      } else {
        URL.revokeObjectURL(previewUrls[item.index]);
        previewUrls.splice(item.index, 1);
        pendingUploads.splice(item.index, 1);
      }
      renderPicturePreviews();
    });
    container.appendChild(div);
  });
}

function handleFileInput(e) {
  const files = e.target.files;
  for (const file of files) {
    pendingUploads.push(file);
    previewUrls.push(URL.createObjectURL(file));
  }
  e.target.value = ''; 
  renderPicturePreviews();
}

document.getElementById('bldg-f-type').addEventListener('change', (e) => {
  const hallGroup = document.getElementById('group-bldg-hall-info');
  if (e.target.value === 'Hall') {
    hallGroup.style.display = 'flex';
    document.getElementById('bldg-f-price').required = true;
    document.getElementById('bldg-f-occupants').required = true;
  } else {
    hallGroup.style.display = 'none';
    document.getElementById('bldg-f-price').required = false;
    document.getElementById('bldg-f-occupants').required = false;
  }
});

document.getElementById('bldg-f-pics-gallery').addEventListener('change', handleFileInput);
document.getElementById('bldg-f-pics-camera').addEventListener('change', handleFileInput);

export function openNewBuildingModal() {
  isEditMode = false;
  currentBuildingId = null;
  duplicateSourceBuildingId = null;
  currentPictures = [];
  pendingUploads = [];
  previewUrls.forEach(url => URL.revokeObjectURL(url));
  previewUrls = [];
  
  document.getElementById('bldg-modal-title').textContent = 'New Building';
  document.getElementById('form-building').reset();
  document.getElementById('bldg-f-details').value = '';
  document.getElementById('bldg-f-price').value = '';
  document.getElementById('bldg-f-occupants').value = '';
  document.getElementById('bldg-f-type').dispatchEvent(new Event('change'));
  document.getElementById('bldg-f-pics-gallery').value = '';
  document.getElementById('bldg-f-pics-camera').value = '';
  renderPicturePreviews();
  document.getElementById('bldg-f-submit').textContent = 'Add';
  document.getElementById('modal-building-form').showModal();
}

export function openEditBuildingModal(bldg) {
  isEditMode = true;
  currentBuildingId = bldg.$id;
  duplicateSourceBuildingId = null;
  currentPictures = bldg.Pictures ? [...bldg.Pictures] : [];
  pendingUploads = [];
  previewUrls.forEach(url => URL.revokeObjectURL(url));
  previewUrls = [];
  
  document.getElementById('bldg-modal-title').textContent = 'Edit Building';
  document.getElementById('bldg-f-name').value = bldg.Name;
  document.getElementById('bldg-f-address').value = bldg.Address;
  document.getElementById('bldg-f-type').value = bldg.Type;
  document.getElementById('bldg-f-type').dispatchEvent(new Event('change'));
  document.getElementById('bldg-f-leasing').value = bldg.LeasingPeriod;
  document.getElementById('bldg-f-details').value = bldg.Details || '';
  document.getElementById('bldg-f-price').value = bldg.Price || '';
  document.getElementById('bldg-f-occupants').value = bldg.MaxOccupants || '';
  document.getElementById('bldg-f-pics-gallery').value = '';
  document.getElementById('bldg-f-pics-camera').value = '';
  
  renderPicturePreviews();
  
  document.getElementById('bldg-f-submit').textContent = 'Save';
  document.getElementById('modal-building-form').showModal();
}

export function openDuplicateBuildingModal(bldg) {
  isEditMode = false;
  currentBuildingId = null;
  duplicateSourceBuildingId = bldg.$id; 
  currentPictures = bldg.Pictures ? [...bldg.Pictures] : [];
  pendingUploads = [];
  previewUrls.forEach(url => URL.revokeObjectURL(url));
  previewUrls = [];
  
  document.getElementById('bldg-modal-title').textContent = 'Duplicate Building';
  document.getElementById('bldg-f-name').value = bldg.Name + ' (copy)';
  document.getElementById('bldg-f-address').value = bldg.Address;
  document.getElementById('bldg-f-type').value = bldg.Type;
  document.getElementById('bldg-f-type').dispatchEvent(new Event('change'));
  document.getElementById('bldg-f-leasing').value = bldg.LeasingPeriod;
  document.getElementById('bldg-f-details').value = bldg.Details || '';
  document.getElementById('bldg-f-price').value = bldg.Price || '';
  document.getElementById('bldg-f-occupants').value = bldg.MaxOccupants || '';
  document.getElementById('bldg-f-pics-gallery').value = '';
  document.getElementById('bldg-f-pics-camera').value = '';
  
  renderPicturePreviews();

  document.getElementById('bldg-f-submit').textContent = 'Save Duplicate';
  document.getElementById('modal-building-form').showModal();
}

export function openNewRoomModal(buildingId) {
  isEditMode = false;
  currentBuildingId = buildingId;
  currentRoomId = null;
  document.getElementById('room-modal-title').textContent = 'New Room';
  document.getElementById('form-room').reset();
  document.getElementById('group-room-name').style.display = 'flex';
  document.getElementById('group-room-count').style.display = 'none';
  document.getElementById('room-f-submit').textContent = 'Add';
  document.getElementById('modal-room-form').showModal();
}

export function openMultipleRoomsModal(buildingId) {
  isEditMode = false;
  currentBuildingId = buildingId;
  currentRoomId = null;
  document.getElementById('room-modal-title').textContent = 'Add Multiple Rooms';
  document.getElementById('form-room').reset();
  document.getElementById('group-room-name').style.display = 'none';
  document.getElementById('group-room-count').style.display = 'flex';
  document.getElementById('room-f-submit').textContent = 'Add';
  document.getElementById('modal-room-form').showModal();
}

export function openEditRoomModal(room) {
  isEditMode = true;
  currentRoomId = room.$id;
  currentBuildingId = room.Building.$id || room.Building;
  document.getElementById('room-modal-title').textContent = 'Edit Room';
  
  document.getElementById('group-room-name').style.display = 'flex';
  document.getElementById('group-room-count').style.display = 'none';
  
  document.getElementById('room-f-name').value = room.RoomName;
  document.getElementById('room-f-status').value = room.Status;
  document.getElementById('room-f-beds').value = room.NbrBeds;
  document.getElementById('room-f-toilets').value = room.NbrToilets;
  document.getElementById('room-f-bedrooms').value = room.NbrBedrooms;
  document.getElementById('room-f-bathrooms').value = room.NbrBathrooms;
  document.getElementById('room-f-occupants').value = room.MaxOccupants;
  document.getElementById('room-f-price').value = room.RoomPrice;
  document.getElementById('room-f-details').value = room.Details || '';

  document.getElementById('room-f-submit').textContent = 'Save';
  document.getElementById('modal-room-form').showModal();
}

// Handle Building Submit
document.getElementById('form-building').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const submitBtn = document.getElementById('bldg-f-submit');
  const originalText = submitBtn.textContent;
  submitBtn.textContent = 'Saving...';
  submitBtn.disabled = true;

  try {
    let pictureUrls = [];

    // Upload new pictures from pendingUploads
    if (pendingUploads.length > 0) {
      for (const file of pendingUploads) {
        const uploadRes = await storage.createFile(BUCKET_ID, ID.unique(), file);
        const viewUrl = storage.getFileView(BUCKET_ID, uploadRes.$id);
        pictureUrls.push(viewUrl.href);
      }
    }

    const data = {
      Name: document.getElementById('bldg-f-name').value,
      Address: document.getElementById('bldg-f-address').value,
      Type: document.getElementById('bldg-f-type').value,
      LeasingPeriod: document.getElementById('bldg-f-leasing').value,
      Details: document.getElementById('bldg-f-details').value,
      Price: document.getElementById('bldg-f-type').value === 'Hall' ? parseFloat(document.getElementById('bldg-f-price').value) : null,
      MaxOccupants: document.getElementById('bldg-f-type').value === 'Hall' ? parseInt(document.getElementById('bldg-f-occupants').value, 10) : null,
      PAdmin: getCurrentPAdmin().$id,
      Pictures: [...currentPictures, ...pictureUrls]
    };

    let savedBldg;
    if (isEditMode) {
      savedBldg = await databases.updateDocument(DB_ID, COLL_BUILDING, currentBuildingId, data);
    } else {
      savedBldg = await databases.createDocument(DB_ID, COLL_BUILDING, ID.unique(), data);
      
      // If it was a duplication, copy the rooms now
      if (duplicateSourceBuildingId) {
        const rooms = await databases.listDocuments(DB_ID, COLL_ROOM, [Query.equal('Building', duplicateSourceBuildingId)]);
        for (const r of rooms.documents) {
          await databases.createDocument(DB_ID, COLL_ROOM, ID.unique(), {
            RoomName: r.RoomName,
            Status: 'Open',
            NbrBeds: r.NbrBeds,
            NbrToilets: r.NbrToilets,
            NbrBedrooms: r.NbrBedrooms,
            NbrBathrooms: r.NbrBathrooms,
            MaxOccupants: r.MaxOccupants,
            RoomPrice: r.RoomPrice,
            Details: r.Details,
            Building: savedBldg.$id
          });
        }
      }
    }

    document.getElementById('modal-building-form').close();
    if (window.location.hash.startsWith('#/dashboard')) renderDashboard();
  } catch (err) {
    console.error(err);
    alert('Failed to save building');
  } finally {
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
  }
});

// Handle Room Submit
document.getElementById('form-room').addEventListener('submit', async (e) => {
  e.preventDefault();
  const isMultiple = document.getElementById('group-room-count').style.display === 'flex';
  const count = parseInt(document.getElementById('room-f-count').value || '1', 10);
  
  const baseData = {
    Status: document.getElementById('room-f-status').value,
    NbrBeds: parseInt(document.getElementById('room-f-beds').value, 10),
    NbrToilets: parseInt(document.getElementById('room-f-toilets').value, 10),
    NbrBedrooms: parseInt(document.getElementById('room-f-bedrooms').value, 10),
    NbrBathrooms: parseInt(document.getElementById('room-f-bathrooms').value, 10),
    MaxOccupants: parseInt(document.getElementById('room-f-occupants').value, 10),
    RoomPrice: parseFloat(document.getElementById('room-f-price').value),
    Details: document.getElementById('room-f-details').value,
    Building: currentBuildingId
  };

  try {
    if (isEditMode) {
      baseData.RoomName = document.getElementById('room-f-name').value;
      await databases.updateDocument(DB_ID, COLL_ROOM, currentRoomId, baseData);
    } else if (isMultiple) {
      for(let i=1; i<=count; i++) {
        const d = { ...baseData, RoomName: `Room ${i}` };
        await databases.createDocument(DB_ID, COLL_ROOM, ID.unique(), d);
      }
    } else {
      baseData.RoomName = document.getElementById('room-f-name').value;
      await databases.createDocument(DB_ID, COLL_ROOM, ID.unique(), baseData);
    }
    document.getElementById('modal-room-form').close();
    renderRoomsList(currentBuildingId);
  } catch (err) {
    console.error(err);
    alert('Failed to save room(s)');
  }
});

// Bookings Modal and Calendar
export async function openBookingsModal(id, isHall = false) {
  const modal = document.getElementById('modal-bookings');
  modal.showModal();

  const calendarEl = document.getElementById('calendar');
  calendarEl.innerHTML = ''; // reset

  const listEl = document.getElementById('bookings-list');
  listEl.innerHTML = '<p>Loading bookings...</p>';

  // Fetch bookings
  let events = [];
  let bookings = [];
  try {
    const queryCol = isHall ? 'Building' : 'Room';
    const res = await databases.listDocuments(DB_ID, COLL_BOOKING, [
      Query.equal(queryCol, id)
    ]);
    bookings = res.documents;
    events = bookings.map(b => {
      // Logic for buyer name... mock for now if relationship is shallow
      const buyerName = b.Buyer && b.Buyer.Name ? b.Buyer.Name : 'Unknown Buyer';
      const buyerEmail = b.Buyer && b.Buyer.Email ? b.Buyer.Email : '';
      return {
        id: b.$id,
        title: `Booked: ${buyerName} (${buyerEmail})`,
        start: b.StartDate,
        end: b.EndDate,
        color: '#ef4444', // red for booked
        allDay: true
      }
    });
  } catch(e) { console.error('Failed to fetch bookings', e); }

  const calendar = new Calendar(calendarEl, {
    plugins: [dayGridPlugin],
    initialView: 'dayGridMonth',
    events: events,
    eventDisplay: 'block',
    height: 'auto'
  });
  
  // FullCalendar needs to render after modal opens and gets layout size
  setTimeout(() => {
    calendar.render();
  }, 100);

  // Render bookings list
  if (bookings.length === 0) {
    listEl.innerHTML = '<p>No bookings found.</p>';
  } else {
    listEl.innerHTML = '';
    bookings.forEach(b => {
      const buyerName = b.Buyer && b.Buyer.Name ? b.Buyer.Name : 'Unknown Buyer';
      const startStr = new Date(b.StartDate).toLocaleDateString();
      const endStr = new Date(b.EndDate).toLocaleDateString();

      const item = document.createElement('div');
      item.className = 'booking-list-item';
      item.innerHTML = `
        <div class="booking-date">${startStr} - ${endStr}</div>
        <div class="booking-name">${buyerName}</div>
      `;
      
      item.addEventListener('click', () => {
        // clear active states
        listEl.querySelectorAll('.booking-list-item').forEach(el => el.classList.remove('active'));
        item.classList.add('active');
        
        // Go to date
        calendar.gotoDate(b.StartDate);
        
        // Reset all colors
        calendar.getEvents().forEach(evt => evt.setProp('color', '#ef4444'));
        
        // Highlight this event
        const calEvent = calendar.getEventById(b.$id);
        if (calEvent) {
          calEvent.setProp('color', '#3b82f6'); // use primary accent color hex
        }
      });
      listEl.appendChild(item);
    });
  }
}

// Reviews Modal
export async function openReviewsModal(roomId) {
  const modal = document.getElementById('modal-reviews');
  const listEl = document.getElementById('reviews-list');
  listEl.innerHTML = '<p>Loading reviews...</p>';
  modal.showModal();

  try {
    // In Appwrite, we have Booking -> Room. Review -> Booking.
    // Fetch bookings first
    const bookingsRes = await databases.listDocuments(DB_ID, COLL_BOOKING, [
      Query.equal('Room', roomId)
    ]);
    const bookingIds = bookingsRes.documents.map(b => b.$id);
    
    if (bookingIds.length === 0) {
      listEl.innerHTML = '<p>No reviews yet.</p>';
      return;
    }

    // Since we cannot use 'IN' query easily if list is large, we map over them or fetch all reviews and filter.
    // Assuming small list for demo
    const reviewsRes = await databases.listDocuments(DB_ID, COLL_REVIEW, []);
    const relevantReviews = reviewsRes.documents.filter(r => r.Booking && bookingIds.includes(r.Booking.$id || r.Booking));

    if (relevantReviews.length === 0) {
      listEl.innerHTML = '<p>No reviews yet.</p>';
      return;
    }

    listEl.innerHTML = relevantReviews.map(r => {
      const date = new Date(r.$createdAt || Date.now()).toLocaleDateString();
      const buyerName = r.Booking && r.Booking.Buyer && r.Booking.Buyer.Name ? r.Booking.Buyer.Name : 'Anonymous';
      return `
        <div class="review-item">
          <div class="review-rating">${r.Rating} ⭐</div>
          <p>${r.Comment}</p>
          <div class="review-meta">${buyerName} • ${date}</div>
        </div>
      `;
    }).join('');

  } catch(err) {
    console.error(err);
    listEl.innerHTML = '<p class="error-msg">Failed to load reviews</p>';
  }
}
