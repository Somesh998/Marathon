document.addEventListener("DOMContentLoaded", () => {
    const views = document.querySelectorAll(".view");
    const navbar = document.getElementById("main-nav");

    // Forms
    const loginForm = document.querySelector(".login-form");
    const registerForm = document.querySelector(".register-form");
    const complaintForm = document.querySelector(".complaint-form");

    // Tables
    const complaintsTableBody = document.getElementById("complaints-table-body"); // User Dashboard
    const myComplaintsTableBody = document.getElementById("my-complaints-table-body"); // User My Complaints
    const adminComplaintsTableBody = document.getElementById("admin-complaints-table-body"); // NEW Admin Dashboard
    const reportsCategoryBody = document.getElementById("reports-category-body"); // NEW Reports

    // Stats (User Dashboard)
    const statTotal = document.getElementById("stat-total");
    const statPending = document.getElementById("stat-pending");
    const statResolved = document.getElementById("stat-resolved");
    
    // Stats (Admin Dashboard)
    const adminStatTotal = document.getElementById("admin-stat-total");
    const adminStatPending = document.getElementById("admin-stat-pending");
    const adminStatResolved = document.getElementById("admin-stat-resolved");

    // Reports
    const reportTotal = document.getElementById("report-total");
    const reportPending = document.getElementById("report-pending");
    const reportResolved = document.getElementById("report-resolved");

    // Navigation Containers
    const userNavLinks = document.getElementById("user-nav-links");
    const adminNavLinks = document.getElementById("admin-nav-links");


    // Backend API URL
    const API_URL = 'http://localhost:5000/api';

    // User state
    let currentUser = null;
    let token = null;
    let userRole = 'user'; // Default role

    // --- Utility Functions ---
    function showView(viewId) {
        views.forEach(v => v.classList.remove("active"));
        document.getElementById(viewId).classList.add("active");
    }

    async function fetchData(path) {
        try {
            const res = await fetch(`${API_URL}${path}`, {
                headers: {
                    'x-auth-token': token
                }
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.message || 'Failed to fetch data');
            }
            return data;
        } catch (error) {
            console.error(error);
            // Alert and logout if session is unauthorized/expired
            if (error.message.includes('authorization denied') || error.message.includes('Token is not valid')) {
                alert("Session expired or unauthorized. Please log in again.");
                logout();
            } else {
                alert(error.message);
            }
        }
    }

    function updateStats(complaints, totalEl, pendingEl, resolvedEl) {
        const total = complaints.length;
        const pending = complaints.filter(c => c.status === "Pending").length;
        const resolved = complaints.filter(c => c.status === "Resolved").length;

        if (totalEl) totalEl.textContent = total;
        if (pendingEl) pendingEl.textContent = pending;
        if (resolvedEl) resolvedEl.textContent = resolved;
    }
    
    // --- Admin Action: Handle Status Update ---
    async function handleStatusUpdate(complaintId, newStatus) {
        try {
            const res = await fetch(`${API_URL}/complaints/${complaintId}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'x-auth-token': token
                },
                body: JSON.stringify({ status: newStatus })
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.message || 'Status update failed');
            }

            alert(`Complaint ${complaintId.slice(-4)} status updated to ${newStatus}`);
            renderAdminDashboard(); // Refresh the table

        } catch (error) {
            alert(error.message);
        }
    }

    // --- User Rendering Functions ---

    async function renderDashboard() {
        // Only fetch and display the logged-in user's complaints for the dashboard
        const myComplaints = await fetchData('/complaints/my');
        if (myComplaints) {
            updateStats(myComplaints, statTotal, statPending, statResolved);
            // Display only the latest 5 in the dashboard table
            complaintsTableBody.innerHTML = "";
            myComplaints.slice(0, 5).forEach(c => {
                const row = `<tr>
                    <td>${c._id.slice(-4)}</td>
                    <td>${c.subject}</td>
                    <td>${c.status}</td>
                    <td>${new Date(c.date).toLocaleDateString()}</td>
                    <td>
                        <button class="btn-action view">View</button>
                    </td>
                </tr>`;
                complaintsTableBody.innerHTML += row;
            });
        }
    }
    
    async function renderMyComplaints() {
        const myComplaints = await fetchData('/complaints/my');
        if (myComplaints) {
            myComplaintsTableBody.innerHTML = "";
            myComplaints.forEach(c => {
                const row = `<tr>
                    <td>${c._id.slice(-4)}</td>
                    <td>${c.subject}</td>
                    <td>${c.category}</td>
                    <td>${c.status}</td>
                    <td>${new Date(c.date).toLocaleDateString()}</td>
                    <td>
                        <button class="btn-action view" data-id="${c._id}">View</button>
                    </td>
                </tr>`;
                myComplaintsTableBody.innerHTML += row;
            });
        }
    }

    // --- Admin Rendering Functions ---

    async function renderAdminDashboard() {
        // Admin fetches ALL complaints
        const complaints = await fetchData('/complaints/all');
        if (complaints) {
            updateStats(complaints, adminStatTotal, adminStatPending, adminStatResolved);
            
            adminComplaintsTableBody.innerHTML = "";
            complaints.forEach(c => {
                const statusColor = c.status === 'Resolved' ? '#1abc9c' : '#f39c12';
                const userEmail = c.user ? c.user.email : 'N/A';
                const row = `<tr>
                    <td>${c._id.slice(-4)}</td>
                    <td>${userEmail}</td>
                    <td>${c.subject}</td>
                    <td>${c.category}</td>
                    <td><span style="color: ${statusColor}; font-weight: bold;">${c.status}</span></td>
                    <td>
                        <select class="btn-action edit status-select" data-id="${c._id}" style="padding: 6px; font-size: 14px;">
                            <option value="Pending" ${c.status === 'Pending' ? 'selected' : ''}>Pending</option>
                            <option value="Resolved" ${c.status === 'Resolved' ? 'selected' : ''}>Resolved</option>
                        </select>
                    </td>
                </tr>`;
                adminComplaintsTableBody.innerHTML += row;
            });

            // Add event listeners for status change
            adminComplaintsTableBody.querySelectorAll(".status-select").forEach(select => {
                select.addEventListener("change", (e) => {
                    const complaintId = e.target.getAttribute("data-id");
                    const newStatus = e.target.value;
                    handleStatusUpdate(complaintId, newStatus);
                });
            });
        }
    }

    async function renderReports() {
        const reportData = await fetchData('/report');
        if (reportData) {
            reportTotal.textContent = reportData.total;
            reportPending.textContent = reportData.pending;
            reportResolved.textContent = reportData.resolved;

            reportsCategoryBody.innerHTML = "";
            reportData.complaintsByCategory.forEach(item => {
                const row = `<tr>
                    <td>${item._id}</td>
                    <td>${item.count}</td>
                </tr>`;
                reportsCategoryBody.innerHTML += row;
            });
        }
    }
    
    // --- Session and Auth Logic ---
    function initializeUserSession(data) {
        token = data.token;
        currentUser = data.username;
        userRole = data.role; // Set the new role
        localStorage.setItem('token', token);
        localStorage.setItem('currentUser', currentUser);
        localStorage.setItem('userRole', userRole); // Save role

        document.getElementById("dashboard-greeting").textContent = `Welcome, ${currentUser}!`;
        navbar.style.display = "flex";
        
        // Dynamic Navbar Setup: Show/Hide links based on role
        userNavLinks.style.display = userRole === 'user' ? 'flex' : 'none';
        adminNavLinks.style.display = userRole === 'admin' ? 'flex' : 'none';

        // Clear previous active links
        document.querySelectorAll(".navbar a.nav-link").forEach(a => a.classList.remove("active"));
        
        // Direct user to the correct view and render data
        if (userRole === 'admin') {
            document.getElementById("nav-admin-dashboard").classList.add("active");
            showView("admin-dashboard-view");
            renderAdminDashboard();
        } else {
            document.getElementById("nav-dashboard").classList.add("active");
            showView("dashboard-view");
            renderDashboard();
        }
    }


    function logout() {
        navbar.style.display = "none";
        currentUser = null;
        token = null;
        userRole = 'user';
        localStorage.removeItem('token');
        localStorage.removeItem('currentUser');
        localStorage.removeItem('userRole');
        showView("login-view");
    }

    // --- Event Listeners ---
    document.getElementById("show-register")?.addEventListener("click", (e) => {
        e.preventDefault();
        showView("register-view");
    });

    document.getElementById("show-login")?.addEventListener("click", (e) => {
        e.preventDefault();
        showView("login-view");
    });

    // Login
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("login-username").value;
        const password = document.getElementById("login-password").value;

        try {
            const res = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.message || 'Login failed');
            }

            initializeUserSession(data);

        } catch (error) {
            alert(error.message);
        }
    });

    // Register
    registerForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        // ... (Registration logic remains the same) ...
        const fullName = document.getElementById("full-name").value;
        const email = document.getElementById("email").value;
        const password = document.getElementById("reg-password").value;
        const confirmPassword = document.getElementById("confirm-password").value;

        if (password !== confirmPassword) {
            alert("Passwords do not match!");
            return;
        }

        try {
            const res = await fetch(`${API_URL}/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ fullName, email, password })
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.message || 'Registration failed');
            }

            alert("Registered successfully! Please login.");
            showView("login-view");
            
        } catch (error) {
            alert(error.message);
        }
    });

    // Navbar navigation (Handles user and admin link clicks)
    document.querySelectorAll(".navbar a.nav-link").forEach(link => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            
            // Clear all active states for all nav links
            document.querySelectorAll(".navbar a.nav-link").forEach(a => a.classList.remove("active"));
            link.classList.add("active");

            const targetView = link.getAttribute("href").replace("#", "") + "-view";
            showView(targetView);
            
            // Render view-specific data
            if (targetView === 'dashboard-view') {
                renderDashboard();
            } else if (targetView === 'my-complaints-view') {
                renderMyComplaints();
            } else if (targetView === 'admin-dashboard-view') {
                renderAdminDashboard();
            } else if (targetView === 'reports-view') {
                renderReports();
            }
        });
    });

    // Logout
    document.getElementById("nav-logout").addEventListener("click", (e) => {
        e.preventDefault();
        logout();
    });

    // Submit complaint
    complaintForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        // ... (Complaint submission logic remains the same) ...
        const category = document.getElementById("category").value;
        const subject = document.getElementById("subject").value;
        const description = document.getElementById("description").value;

        if (!token) {
            alert("You must be logged in to submit a complaint!");
            logout();
            return;
        }

        try {
            const res = await fetch(`${API_URL}/complaints`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-auth-token': token
                },
                body: JSON.stringify({ category, subject, description })
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.message || 'Complaint submission failed');
            }

            complaintForm.reset();
            alert("Complaint submitted successfully! Redirecting to My Complaints.");
            
            // Navigate to My Complaints and activate the link
            showView("my-complaints-view");
            document.querySelectorAll(".navbar a.nav-link").forEach(a => a.classList.remove("active"));
            document.getElementById("nav-my-complaints").classList.add("active");
            
            renderMyComplaints();

        } catch (error) {
            alert(error.message);
        }
    });

    // Initial check for a saved session
    token = localStorage.getItem('token');
    currentUser = localStorage.getItem('currentUser');
    userRole = localStorage.getItem('userRole');

    if (token && currentUser && userRole) {
        // Dynamic Navbar Setup
        userNavLinks.style.display = userRole === 'user' ? 'flex' : 'none';
        adminNavLinks.style.display = userRole === 'admin' ? 'flex' : 'none';
        
        document.getElementById("dashboard-greeting").textContent = `Welcome, ${currentUser}!`;
        navbar.style.display = "flex";

        // Direct user to the correct view and render data
        if (userRole === 'admin') {
            document.querySelectorAll(".navbar a.nav-link").forEach(a => a.classList.remove("active"));
            document.getElementById("nav-admin-dashboard").classList.add("active");
            showView("admin-dashboard-view");
            renderAdminDashboard();
        } else {
            document.querySelectorAll(".navbar a.nav-link").forEach(a => a.classList.remove("active"));
            document.getElementById("nav-dashboard").classList.add("active");
            showView("dashboard-view");
            renderDashboard();
        }
    } else {
        showView("login-view");
    }
});