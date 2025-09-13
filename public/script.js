// Global variables
let issuesChartInstance = null;
let categoryChartInstance = null;
let departmentChartInstance = null;
let allIssues = [];
let map;
let mapMarkers = [];
let adminToken = null;

// Initialize map
function initMap() {
    map = L.map('map').setView([20.5937, 78.9629], 5); // Center on India
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    
    // Add some sample markers for demonstration
    addSampleMarkers();
}

// Add sample markers to the map
function addSampleMarkers() {
    const locations = [
        { lat: 28.6139, lng: 77.2090, title: "Pothole on Main Road", category: "Roads & Potholes", priority: "high" },
        { lat: 19.0760, lng: 72.8777, title: "Garbage not collected", category: "Waste Management", priority: "medium" },
        { lat: 12.9716, lng: 77.5946, title: "Street light not working", category: "Street Lighting", priority: "low" },
        { lat: 22.5726, lng: 88.3639, title: "Water leakage", category: "Water Supply", priority: "high" },
        { lat: 13.0827, lng: 80.2707, title: "Broken sidewalk", category: "Roads & Potholes", priority: "medium" }
    ];
    
    locations.forEach(location => {
        let markerColor;
        if (location.priority === "high") markerColor = "red";
        else if (location.priority === "medium") markerColor = "orange";
        else markerColor = "green";
        
        const marker = L.marker([location.lat, location.lng], {
            icon: L.divIcon({
                className: 'custom-marker',
                html: `<div style="background-color: ${markerColor}; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white;"></div>`,
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            })
        }).addTo(map);
        
        marker.bindPopup(`
            <strong>${location.title}</strong><br>
            Category: ${location.category}<br>
            Priority: <span class="badge bg-${location.priority === 'high' ? 'danger' : location.priority === 'medium' ? 'warning' : 'success'}">${location.priority}</span>
        `);
        
        mapMarkers.push(marker);
    });
}

// Function to show notification
function showNotification(message, type = 'success') {
    const notification = document.querySelector('.notification');
    const messageEl = document.getElementById('notification-message');
    
    messageEl.textContent = message;
    notification.classList.remove('alert-success', 'alert-danger', 'alert-info');
    notification.classList.add(`alert-${type}`);
    notification.classList.add('show');
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

// Function to fetch issues from the server
async function fetchIssues() {
    try {
        const response = await fetch('/api/issues');
        if (response.ok) {
            allIssues = await response.json();
            renderIssues();
            updateCharts();
            document.getElementById('issues-count').textContent = `${allIssues.length} issues reported`;
        } else {
            console.error('Failed to fetch issues');
        }
    } catch (error) {
        console.error('Error fetching issues:', error);
        // Use sample data if API fails
        const sampleIssues = [
            { id: 1, category: 'Roads & Potholes', title: 'Large pothole on Main St', description: 'There is a large pothole that needs immediate attention', location: 'Main St & 5th Ave', status: 'pending', date: '2023-06-15', priority: 'high' },
            { id: 2, category: 'Waste Management', title: 'Overflowing trash bin', description: 'Public trash bin has been overflowing for 2 days', location: 'Central Park', status: 'in-progress', date: '2023-06-14', priority: 'medium' },
            { id: 3, category: 'Street Lighting', title: 'Broken street light', description: 'Street light has been out for a week', location: 'Oak Street', status: 'resolved', date: '2023-06-10', priority: 'low' },
            { id: 4, category: 'Water Supply', title: 'Water leak on sidewalk', description: 'Constant water leak from underground pipe', location: '3rd Ave & Elm St', status: 'pending', date: '2023-06-13', priority: 'high' }
        ];
        allIssues = sampleIssues;
        renderIssues();
        updateCharts();
    }
}

// Function to render issues in the scrolling feed
function renderIssues() {
    const issuesScroll = document.getElementById('issues-scroll');
    issuesScroll.innerHTML = '';
    
    allIssues.forEach(issue => {
        const statusClass = issue.status === 'pending' ? 'status-pending' : 
                          issue.status === 'in-progress' ? 'status-in-progress' : 'status-resolved';
        const statusText = issue.status === 'pending' ? 'Pending' : 
                         issue.status === 'in-progress' ? 'In Progress' : 'Resolved';
        
        const priorityClass = issue.priority === 'high' ? 'bg-danger' : 
                            issue.priority === 'medium' ? 'bg-warning' : 'bg-success';
        
        const issueItem = document.createElement('div');
        issueItem.className = `issue-item ${issue.priority === 'high' ? 'urgent' : ''}`;
        issueItem.innerHTML = `
            <div class="d-flex justify-content-between align-items-start mb-2">
                <span class="badge bg-secondary">${issue.category}</span>
                <div>
                    <span class="status-badge ${statusClass}">${statusText}</span>
                    <span class="badge ${priorityClass} ms-1">${issue.priority}</span>
                </div>
            </div>
            <h6 class="mb-1">${issue.title}</h6>
            <p class="mb-1 small">${issue.description}</p>
            <div class="d-flex justify-content-between align-items-center">
                <small class="text-muted"><i class="fas fa-map-marker-alt me-1"></i> ${issue.location}</small>
                <small class="text-muted">${new Date(issue.created_at || issue.date).toLocaleDateString()}</small>
            </div>
        `;
        issuesScroll.appendChild(issueItem);
    });
}

// Function to update charts
async function updateCharts() {
    // Update issues chart
    const issuesCtx = document.getElementById('issuesChart').getContext('2d');
    
    // Destroy previous chart instance if it exists
    if (issuesChartInstance) {
        issuesChartInstance.destroy();
    }
    
    // Prepare data for issues chart (last 6 months)
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentMonth = new Date().getMonth();
    const labels = [];
    const reportedData = [];
    const resolvedData = [];
    
    for (let i = 5; i >= 0; i--) {
        const monthIndex = (currentMonth - i + 12) % 12;
        labels.push(months[monthIndex]);
        
        // In a real app, you would get this data from the server
        reportedData.push(Math.floor(Math.random() * 20) + 10);
        resolvedData.push(Math.floor(Math.random() * 15) + 5);
    }
    
    issuesChartInstance = new Chart(issuesCtx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Reported Issues',
                    data: reportedData,
                    backgroundColor: 'rgba(52, 152, 219, 0.7)'
                },
                {
                    label: 'Resolved Issues',
                    data: resolvedData,
                    backgroundColor: 'rgba(39, 174, 96, 0.7)'
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${context.raw}`;
                        }
                    }
                }
            },
            onClick: (e, elements) => {
                if (elements.length > 0) {
                    const index = elements[0].index;
                    const month = labels[index];
                    showNotification(`Showing details for ${month}`, 'info');
                }
            }
        }
    });

    // Update category chart
    const categoryCtx = document.getElementById('categoryChart').getContext('2d');
    
    // Destroy previous chart instance if it exists
    if (categoryChartInstance) {
        categoryChartInstance.destroy();
    }
    
    // Prepare data for category chart
    const categoryData = {};
    allIssues.forEach(issue => {
        categoryData[issue.category] = (categoryData[issue.category] || 0) + 1;
    });
    
    const categoryLabels = Object.keys(categoryData);
    const categoryValues = Object.values(categoryData);
    
    categoryChartInstance = new Chart(categoryCtx, {
        type: 'doughnut',
        data: {
            labels: categoryLabels,
            datasets: [{
                data: categoryValues,
                backgroundColor: [
                    'rgba(52, 152, 219, 0.7)',
                    'rgba(46, 204, 113, 0.7)',
                    'rgba(155, 89, 182, 0.7)',
                    'rgba(52, 73, 94, 0.7)',
                    'rgba(241, 196, 15, 0.7)',
                    'rgba(230, 126, 34, 0.7)'
                ]
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom',
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = Math.round((value / total) * 100);
                            return `${label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            },
            onClick: (e, elements) => {
                if (elements.length > 0) {
                    const index = elements[0].index;
                    const category = categoryLabels[index];
                    showNotification(`Filtering issues by ${category}`, 'info');
                    // In a real app, you would filter the issues by category
                }
            }
        }
    });

    // Update department performance chart
    const deptCtx = document.getElementById('departmentChart').getContext('2d');
    
    // Destroy previous chart instance if it exists
    if (departmentChartInstance) {
        departmentChartInstance.destroy();
    }
    
    // Sample department performance data
    const deptData = {
        labels: ['Public Works', 'Sanitation', 'Water Board', 'Transport', 'Electricity'],
        datasets: [{
            label: 'Average Resolution Time (days)',
            data: [5.2, 3.8, 4.5, 6.1, 4.9],
            backgroundColor: 'rgba(52, 152, 219, 0.7)'
        }, {
            label: 'Satisfaction Rating (%)',
            data: [82, 88, 79, 75, 85],
            backgroundColor: 'rgba(46, 204, 113, 0.7)',
            type: 'line',
            yAxisID: 'y1'
        }]
    };
    
    departmentChartInstance = new Chart(deptCtx, {
        type: 'bar',
        data: deptData,
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'top',
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Resolution Time (days)'
                    }
                },
                y1: {
                    position: 'right',
                    beginAtZero: true,
                    max: 100,
                    title: {
                        display: true,
                        text: 'Satisfaction (%)'
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                }
            }
        }
    });
}

// Event listener for issue submission
document.getElementById('submitIssue').addEventListener('click', async function() {
    const category = document.getElementById('category').value;
    const title = document.getElementById('title').value;
    const description = document.getElementById('description').value;
    const location = document.getElementById('location').value;
    const urgent = document.getElementById('urgent').checked;
    const anonymous = document.getElementById('anonymous').checked;
    const imageFile = document.getElementById('image').files[0];
    
    if (!category || !title || !description || !location) {
        showNotification('Please fill in all required fields.', 'danger');
        return;
    }
    
    const formData = new FormData();
    formData.append('category', category);
    formData.append('title', title);
    formData.append('description', description);
    formData.append('location', location);
    formData.append('priority', urgent ? 'high' : 'normal');
    
    if (imageFile) {
        formData.append('image', imageFile);
    }
    
    try {
        const response = await fetch('/api/issues', {
            method: 'POST',
            body: formData
        });
        
        if (response.ok) {
            const result = await response.json();
            showNotification('Issue reported successfully! Thank you for your contribution.');
            document.getElementById('issueForm').reset();
            
            // Close the modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('reportModal'));
            modal.hide();
            
            // Refresh the issues and charts
            fetchIssues();
        } else {
            const error = await response.json();
            showNotification(`Error: ${error.error}`, 'danger');
        }
    } catch (error) {
        showNotification('Error submitting issue. Please try again.', 'danger');
        console.error('Error:', error);
    }
});

// Event listeners for interactive category cards
document.querySelectorAll('.interactive-card').forEach(card => {
    card.addEventListener('click', function() {
        const category = this.getAttribute('data-category');
        document.getElementById('category').value = category;
        
        const modal = new bootstrap.Modal(document.getElementById('reportModal'));
        modal.show();
        
        // Add a highlight effect to the selected category
        this.classList.add('pulse');
        setTimeout(() => {
            this.classList.remove('pulse');
        }, 2000);
    });
});

// Locate me button functionality
document.getElementById('locateMe').addEventListener('click', function() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            function(position) {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                
                // Use reverse geocoding to get address (simulated)
                const addresses = [
                    "123 Main Street",
                    "456 Park Avenue",
                    "789 Downtown Plaza",
                    "321 Central Road"
                ];
                
                const randomAddress = addresses[Math.floor(Math.random() * addresses.length)];
                document.getElementById('location').value = randomAddress;
                
                showNotification('Location detected successfully!', 'success');
            },
            function(error) {
                showNotification('Unable to retrieve your location. Please enter manually.', 'danger');
            }
        );
    } else {
        showNotification('Geolocation is not supported by your browser.', 'danger');
    }
});

// Admin login functionality
// Admin login functionality
document.getElementById('adminLoginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const departmentId = document.getElementById('departmentId').value;
    const password = document.getElementById('adminPassword').value;
    
    try {
        const response = await fetch('/api/admin/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ department_id: departmentId, password })
        });
        
        if (response.ok) {
            const result = await response.json();
            // Store the token in localStorage
            localStorage.setItem('adminToken', result.token);
            localStorage.setItem('adminDepartment', JSON.stringify(result.department));
            
            showNotification('Login successful! Redirecting to admin dashboard.', 'success');
            
            // Close the modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('adminLoginModal'));
            modal.hide();
            
            // Redirect to admin page after a brief delay
            setTimeout(() => {
                window.location.href = '/admin';
            }, 1000);
        } else {
            const error = await response.json();
            showNotification(`Error: ${error.error}`, 'danger');
        }
    } catch (error) {
        showNotification('Error logging in. Please try again.', 'danger');
        console.error('Error:', error);
    }
});
// Department registration link
document.getElementById('registerDeptLink').addEventListener('click', function(e) {
    e.preventDefault();
    
    // Close login modal and open registration modal
    const loginModal = bootstrap.Modal.getInstance(document.getElementById('adminLoginModal'));
    loginModal.hide();
    
    const regModal = new bootstrap.Modal(document.getElementById('deptRegistrationModal'));
    regModal.show();
});

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    initMap();
    fetchIssues();
    
    // Refresh data every 30 seconds
    setInterval(fetchIssues, 30000);
});