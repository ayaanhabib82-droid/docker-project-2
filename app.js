const STORAGE_KEY = "zepprz-demo-state-v1";

const initialState = {
  activeView: "rider",
  available: true,
  bookings: [],
  pickup: "",
  destination: "",
};

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    return saved && Array.isArray(saved.bookings)
      ? { ...initialState, ...saved }
      : { ...initialState };
  } catch (error) {
    console.error("Could not load saved Zepprz demo state.", error);
    return { ...initialState };
  }
}

let state = loadState();
let toastTimer;
const content = document.getElementById("app-content");
const toast = document.getElementById("toast");

const statusLabels = {
  assigned: "Driver assigned",
  arriving: "Driver on the way",
  in_progress: "Ride in progress",
  completed: "Completed",
  cancelled: "Cancelled",
};
const flowSteps = ["Driver assigned", "Driver on the way", "Ride in progress", "Completed"];

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error("Could not save Zepprz demo state.", error);
    showToast("Your browser could not save this demo session.");
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 2800);
}

function activeBooking() {
  return state.bookings.find((booking) => !["completed", "cancelled"].includes(booking.status));
}

function fareFor(pickup, destination) {
  const seed = `${pickup.trim().toLowerCase()}|${destination.trim().toLowerCase()}`;
  let hash = 0;
  for (const character of seed) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return 350 + (hash % 9) * 50;
}

function formatMoney(amount) {
  return `Rs ${Number(amount).toLocaleString("en-PK")}`;
}

function formatTime(timestamp) {
  return new Intl.DateTimeFormat("en-PK", { hour: "numeric", minute: "2-digit" }).format(new Date(timestamp));
}

function statusClass(status) {
  if (status === "completed") return "completed";
  if (status === "cancelled") return "cancelled";
  return "";
}

function renderMap(pickup, destination) {
  return `
    <div class="card map-card" aria-label="Illustrative Karachi route preview">
      <div class="map-visual">
        <span class="map-road road-one"></span><span class="map-road road-two"></span>
        <span class="map-route"></span>
        <span class="map-pin pickup"><span>•</span></span><span class="map-pin dropoff"><span>•</span></span>
        <span class="map-label label-one">${escapeHtml(pickup || "Karachi")}</span>
        <span class="map-label label-two">${escapeHtml(destination || "Your destination")}</span>
        <span class="map-caption">Illustrative route · Karachi</span>
      </div>
    </div>`;
}

function renderHistoryRow(booking) {
  return `
    <div class="ride-row">
      <div><strong>${escapeHtml(booking.pickup)} <span aria-hidden="true">→</span> ${escapeHtml(booking.destination)}</strong><span>${formatTime(booking.createdAt)} · Standard</span></div>
      <div class="ride-row-right"><strong>${formatMoney(booking.fare)}</strong><span class="status-tag ${statusClass(booking.status)}">${statusLabels[booking.status]}</span></div>
    </div>`;
}

function renderBookingProgress(booking) {
  const currentIndex = ["assigned", "arriving", "in_progress", "completed"].indexOf(booking.status);
  const steps = flowSteps.map((step, index) => `
    <span class="progress-step ${index <= currentIndex ? "done" : ""}" aria-label="${step}">${index < currentIndex ? "✓" : index + 1}</span>
    ${index < flowSteps.length - 1 ? `<span class="progress-bar ${index < currentIndex ? "done" : ""}"></span>` : ""}`).join("");
  return `
    <section class="card booking-progress">
      <div class="progress-top"><div><h2>Your ride</h2><p>${escapeHtml(booking.id)} · ${formatTime(booking.createdAt)}</p></div><span class="status-tag">${statusLabels[booking.status]}</span></div>
      <div class="progress-line" aria-label="Ride progress">${steps}</div>
      <div class="assigned-driver"><div class="driver-avatar">👨🏻‍✈️</div><div><strong>${escapeHtml(booking.driver.name)}</strong><span>${escapeHtml(booking.driver.car)} · ${escapeHtml(booking.driver.plate)}</span></div><span class="status-tag completed">★ ${booking.driver.rating}</span></div>
      <div class="booking-route">
        <div class="route-item"><span class="route-dot"></span><span>${escapeHtml(booking.pickup)}</span></div>
        <div class="route-item"><span class="route-dot end"></span><span>${escapeHtml(booking.destination)}</span></div>
      </div>
      ${booking.status === "completed" ? `<p class="helper-text">Thanks for riding with Zepprz! Driver rating: ${booking.rating ? `${booking.rating} / 5 stars` : "Not rated yet"}</p>${booking.rating ? "" : `<button class="button-secondary full-width" data-action="rate-ride" data-id="${booking.id}">Rate your ride</button>`}` : ""}
      ${booking.status === "cancelled" ? `<p class="helper-text">This demo ride was cancelled.</p>` : ""}
      ${!["completed", "cancelled"].includes(booking.status) ? `<button class="button-secondary full-width" data-action="cancel-ride" data-id="${booking.id}">Cancel ride</button>` : ""}
      <p class="helper-text">Demo ride status only · no live location</p>
    </section>`;
}

function renderRider() {
  const current = activeBooking();
  const latest = state.bookings[0];
  const pickup = current?.pickup || state.pickup;
  const destination = current?.destination || state.destination;
  const fare = pickup.trim() && destination.trim() ? fareFor(pickup, destination) : null;
  const panel = current
    ? renderBookingProgress(current)
    : latest?.status === "completed"
      ? renderBookingProgress(latest)
    : latest
      ? `<section class="card">${renderHistoryRow(latest)}</section>`
      : `<section class="card no-ride-note">Your route preview will show up here once you choose a pickup and destination.</section>`;

  content.innerHTML = `
    <div class="page-heading"><div><p class="eyebrow">YOUR NEXT JOURNEY</p><h1>Where are we going?</h1><p class="subheading">A better ride around Karachi starts here.</p></div><span class="date-label">Standard rides · Cash payment</span></div>
    <div class="rider-layout">
      <section class="card booking-card">
        <div class="card-title"><span class="title-icon">⌖</span><div><h2>Plan your ride</h2><p>Choose your pickup and destination</p></div></div>
        <label class="field-label" for="pickup">PICKUP LOCATION</label>
        <div class="location-fields">
          <div class="input-wrap"><span class="input-marker"></span><input id="pickup" class="location-input" placeholder="e.g. Clifton, Karachi" value="${escapeHtml(pickup)}" ${current ? "disabled" : ""} autocomplete="street-address" /></div>
          <div class="input-wrap"><span class="input-marker destination"></span><input id="destination" class="location-input" placeholder="e.g. Saddar, Karachi" value="${escapeHtml(destination)}" ${current ? "disabled" : ""} autocomplete="street-address" /></div>
        </div>
        <div class="section-divider"></div>
        <span class="field-label">YOUR RIDE</span>
        <div class="ride-option"><span class="car-icon">🚘</span><div class="ride-details"><strong>Standard</strong><span>Comfortable everyday ride · up to 4</span></div><div class="fare"><strong>${fare ? formatMoney(fare) : "—"}</strong><span>estimated fare</span></div></div>
        <button class="button-primary full-width" data-action="request-ride" ${current || !fare ? "disabled" : ""}>${current ? "Ride in progress" : "Request a ride"} <span aria-hidden="true">→</span></button>
        <p class="helper-text">${current ? "Finish or cancel your active ride before booking another." : "Cash payment · Fare is an estimate for this demo."}</p>
      </section>
      <div>${renderMap(pickup, destination)}<div class="section-heading"><h2>${current ? "Ride status" : latest ? "Recent ride" : "Ready when you are"}</h2></div>${panel}</div>
    </div>
    <div class="section-heading"><h2>Your recent rides</h2><button class="text-button" data-action="clear-history">Clear demo history</button></div>
    <section class="card">${state.bookings.length ? state.bookings.slice(0, 4).map(renderHistoryRow).join("") : `<div class="empty-state">Your completed rides will appear here.</div>`}</section>`;

  document.getElementById("pickup").addEventListener("input", (event) => {
    state.pickup = event.target.value;
    saveState();
    updateFareAndRoute();
  });
  document.getElementById("destination").addEventListener("input", (event) => {
    state.destination = event.target.value;
    saveState();
    updateFareAndRoute();
  });
}

function updateFareAndRoute() {
  const pickup = document.getElementById("pickup")?.value || "";
  const destination = document.getElementById("destination")?.value || "";
  const fare = pickup.trim() && destination.trim() ? fareFor(pickup, destination) : null;
  const fareElement = document.querySelector(".fare strong");
  const requestButton = document.querySelector('[data-action="request-ride"]');
  const mapLabels = document.querySelectorAll(".map-label");
  if (fareElement) fareElement.textContent = fare ? formatMoney(fare) : "—";
  if (requestButton) requestButton.disabled = !fare;
  if (mapLabels.length === 2) {
    mapLabels[0].textContent = pickup || "Karachi";
    mapLabels[1].textContent = destination || "Your destination";
  }
}

function renderDriver() {
  const booking = activeBooking();
  const latest = booking || state.bookings[0];
  const progressAction = { assigned: ["arriving", "Start heading to pickup"], arriving: ["in_progress", "Start trip"], in_progress: ["completed", "Complete trip"] };
  const next = booking && progressAction[booking.status];
  content.innerHTML = `
    <div class="page-heading"><div><p class="eyebrow">DRIVER WORKSPACE</p><h1>Good day, Ayaan</h1><p class="subheading">Manage your availability and ride requests.</p></div><span class="date-label">Karachi, Pakistan</span></div>
    <div class="driver-layout">
      <div>
        <section class="card availability-card">
          <div class="availability-row"><div><strong>${state.available ? "You're online" : "You're offline"}</strong><span>${state.available ? "You can receive ride requests." : "Go online when you're ready to drive."}</span></div><button class="toggle ${state.available ? "on" : ""}" data-action="toggle-availability" role="switch" aria-checked="${state.available}" aria-label="Toggle driver availability"></button></div>
        </section>
        <div class="quick-stats">
          <div class="card stat-card"><span>Today's rides</span><strong>${state.bookings.filter((item) => item.status === "completed").length}</strong><small>Completed rides</small></div>
          <div class="card stat-card"><span>Today's earnings</span><strong>${formatMoney(state.bookings.filter((item) => item.status === "completed").reduce((sum, item) => sum + item.fare, 0))}</strong><small>Cash collected</small></div>
          <div class="card stat-card"><span>Driver rating</span><strong>4.9 ★</strong><small>Demo profile</small></div>
        </div>
        <div class="section-heading"><h2>Current ride</h2></div>
        ${booking ? `<section class="card request-card"><div class="request-header"><h2>${statusLabels[booking.status]}</h2><span class="status-tag">${booking.id}</span></div><p>Pickup: <strong>${escapeHtml(booking.pickup)}</strong><br />Drop-off: <strong>${escapeHtml(booking.destination)}</strong><br />Rider: Ayaan S. · Cash</p><div class="request-fare"><span>Estimated fare</span><strong>${formatMoney(booking.fare)}</strong></div>${next ? `<button class="button-primary full-width" data-action="advance-ride" data-id="${booking.id}" data-status="${next[0]}">${next[1]} →</button>` : `<p class="helper-text">Ride complete. Switch to Rider to leave a rating.</p>`}</section>` : `<section class="card no-ride-note">${state.available ? "No active request. New demo bookings will appear here automatically." : "Go online to receive demo ride requests."}</section>`}
      </div>
      <aside class="card request-card"><div class="request-header"><h2>Driver profile</h2><span class="status-tag completed">Verified</span></div><div class="assigned-driver"><div class="driver-avatar">👨🏻‍✈️</div><div><strong>Ayaan Siddiqui</strong><span>4.9 rating · 120 demo trips</span></div></div><div class="section-divider"></div><p><strong>Vehicle</strong><br />Suzuki Alto · White<br /><br /><strong>Registration</strong><br />KHI-1234</p><p class="helper-text">Driver profile and verification are illustrative demo data.</p></aside>
    </div>
    <div class="section-heading"><h2>Recent activity</h2></div>
    <section class="card">${latest ? renderHistoryRow(latest) : `<div class="empty-state">Ride activity will appear here after a booking.</div>`}</section>`;
}

function renderAdmin() {
  const completed = state.bookings.filter((booking) => booking.status === "completed");
  const active = state.bookings.filter((booking) => !["completed", "cancelled"].includes(booking.status));
  const earnings = completed.reduce((sum, booking) => sum + booking.fare, 0);
  const rows = state.bookings.length
    ? state.bookings.map((booking) => `<tr><td>${booking.id}</td><td>${escapeHtml(booking.pickup)} → ${escapeHtml(booking.destination)}</td><td>Ayaan Siddiqui</td><td>${formatMoney(booking.fare)}</td><td><span class="status-tag ${statusClass(booking.status)}">${statusLabels[booking.status]}</span></td><td>${formatTime(booking.createdAt)}</td></tr>`).join("")
    : `<tr><td colspan="6" class="empty-state">No rides yet. Create a booking from the Rider app view.</td></tr>`;
  content.innerHTML = `
    <div class="page-heading"><div><p class="eyebrow">ZEPPRZ OPERATIONS</p><h1>Admin dashboard</h1><p class="subheading">A snapshot of your Karachi ride operations.</p></div><span class="date-label">Today · Karachi, PK</span></div>
    <div class="admin-stats">
      <div class="card admin-stat"><div class="admin-stat-top">Total bookings <span class="admin-stat-icon">↗</span></div><strong>${state.bookings.length}</strong><small>Demo rides created</small></div>
      <div class="card admin-stat"><div class="admin-stat-top">Active rides <span class="admin-stat-icon">⌖</span></div><strong>${active.length}</strong><small>Currently in progress</small></div>
      <div class="card admin-stat"><div class="admin-stat-top">Completed <span class="admin-stat-icon">✓</span></div><strong>${completed.length}</strong><small>Rides completed</small></div>
      <div class="card admin-stat"><div class="admin-stat-top">Cash fares <span class="admin-stat-icon">₨</span></div><strong>${formatMoney(earnings)}</strong><small>Completed demo rides</small></div>
    </div>
    <div class="section-heading"><h2>Ride bookings</h2><button class="text-button" data-action="clear-history">Clear demo data</button></div>
    <section class="card table-card"><div class="table-header"><h2>All rides <span class="pill">${state.bookings.length}</span></h2><span class="pill">Karachi · Standard</span></div><div class="table-scroll"><table class="ride-table"><thead><tr><th>BOOKING</th><th>ROUTE</th><th>DRIVER</th><th>FARE</th><th>STATUS</th><th>TIME</th></tr></thead><tbody>${rows}</tbody></table></div></section>
    <section class="card driver-list-card"><div class="section-heading"><h2>Driver availability</h2><span class="pill online">1 demo driver</span></div><div class="ride-row"><div><strong>Ayaan Siddiqui</strong><span>Suzuki Alto · KHI-1234 · 4.9 ★</span></div><span class="pill ${state.available ? "online" : ""}">${state.available ? "Online" : "Offline"}</span></div></section>
    <p class="helper-text">All dashboard figures are stored only in this browser and are for demonstration.</p>`;
}

function render() {
  const labels = { rider: "Rider app", driver: "Driver app", admin: "Admin dashboard" };
  document.getElementById("workspace-label").textContent = labels[state.activeView];
  document.querySelectorAll(".role-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === state.activeView);
    if (button.dataset.view === state.activeView) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  if (state.activeView === "driver") renderDriver();
  else if (state.activeView === "admin") renderAdmin();
  else renderRider();
}

function requestRide() {
  const pickup = document.getElementById("pickup")?.value.trim();
  const destination = document.getElementById("destination")?.value.trim();
  if (!pickup || !destination) {
    showToast("Add both pickup and destination to estimate your ride.");
    return;
  }
  if (activeBooking()) {
    showToast("Complete or cancel your active ride before booking another.");
    return;
  }
  if (!state.available) {
    showToast("No nearby drivers are available right now. Please try again shortly.");
    return;
  }
  const ride = {
    id: `ZP-${String(Date.now()).slice(-6)}`,
    pickup,
    destination,
    fare: fareFor(pickup, destination),
    createdAt: new Date().toISOString(),
    status: "assigned",
    rating: null,
    driver: { name: "Ayaan Siddiqui", car: "Suzuki Alto", plate: "KHI-1234", rating: "4.9" },
  };
  state.pickup = pickup;
  state.destination = destination;
  state.bookings.unshift(ride);
  saveState();
  render();
  showToast("A nearby demo driver has been assigned.");
}

function advanceRide(id, status) {
  const ride = state.bookings.find((booking) => booking.id === id);
  if (!ride || !["arriving", "in_progress", "completed"].includes(status)) {
    showToast("That ride status could not be updated.");
    return;
  }
  ride.status = status;
  saveState();
  render();
  showToast(status === "completed" ? "Trip completed. Cash fare collected." : `Ride updated: ${statusLabels[status]}.`);
}

document.addEventListener("click", (event) => {
  const roleButton = event.target.closest(".role-button");
  if (roleButton) {
    state.activeView = roleButton.dataset.view;
    saveState();
    render();
    return;
  }
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const { action } = button.dataset;
  if (action === "request-ride") requestRide();
  else if (action === "toggle-availability") {
    state.available = !state.available;
    saveState();
    render();
    showToast(state.available ? "You're online and ready for demo requests." : "You're now offline.");
  } else if (action === "advance-ride") advanceRide(button.dataset.id, button.dataset.status);
  else if (action === "cancel-ride") {
    const ride = state.bookings.find((booking) => booking.id === button.dataset.id);
    if (ride) {
      ride.status = "cancelled";
      saveState();
      render();
      showToast("Demo ride cancelled.");
    }
  } else if (action === "rate-ride") {
    const ride = state.bookings.find((booking) => booking.id === button.dataset.id);
    if (ride) {
      ride.rating = 5;
      saveState();
      render();
      showToast("Thanks! Your demo rating is 5 stars.");
    }
  } else if (action === "clear-history") {
    if (!state.bookings.length) {
      showToast("There is no demo ride history to clear.");
      return;
    }
    state.bookings = [];
    saveState();
    render();
    showToast("Demo ride history cleared.");
  }
});

render();
