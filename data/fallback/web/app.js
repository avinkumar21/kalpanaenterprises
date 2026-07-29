let allServices = [];
let currentCategory = 'ALL';

// DOM Elements
const servicesGrid = document.getElementById('services-grid');
const searchInput = document.getElementById('search-input');
const navItems = document.querySelectorAll('.nav-item');
const currentCategoryTitle = document.getElementById('current-category-title');
const resultsCount = document.getElementById('results-count');
const menuToggle = document.getElementById('menu-toggle');
const sidebar = document.getElementById('sidebar');

// Modal Elements
const modal = document.getElementById('details-modal');
const closeModalBtn = document.getElementById('close-modal');
const modalCategory = document.getElementById('modal-category');
const modalTitle = document.getElementById('modal-title');
const modalDesc = document.getElementById('modal-desc');
const modalGovFee = document.getElementById('modal-gov-fee');
const modalServiceCharge = document.getElementById('modal-service-charge');
const modalDocs = document.getElementById('modal-docs');
const modalEligibility = document.getElementById('modal-eligibility');
const modalAuth = document.getElementById('modal-auth');
const modalAuthContainer = document.getElementById('modal-auth-container');
const modalLink = document.getElementById('modal-link');

// Fetch data
async function init() {
    try {
        const response = await fetch('/dataset.json');
        if (!response.ok) throw new Error('Network response was not ok');
        allServices = await response.json();
        renderServices(allServices);
    } catch (error) {
        console.error('Error fetching data:', error);
        servicesGrid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted);">
                <i class="fa-solid fa-triangle-exclamation" style="font-size: 3rem; color: #f59e0b; margin-bottom: 1rem;"></i>
                <h2>Failed to load services</h2>
                <p>Please make sure you are running the local server and dataset.json exists.</p>
            </div>
        `;
    }
}

// Render Services
function renderServices(services) {
    servicesGrid.innerHTML = '';
    
    if (services.length === 0) {
        servicesGrid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted);">
                <i class="fa-solid fa-magnifying-glass" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                <h2>No services found</h2>
                <p>Try adjusting your search or filter.</p>
            </div>
        `;
        resultsCount.textContent = '0 results';
        return;
    }

    resultsCount.textContent = `${services.length} service${services.length > 1 ? 's' : ''} found`;

    services.forEach((service, index) => {
        const card = document.createElement('div');
        
        let colorClass = 'color-default';
        if(service.service_category === 'CENTRAL GOVERNMENT SERVICES') colorClass = 'color-central';
        else if(service.service_category === 'KARNATAKA GOVERNMENT SERVICES') colorClass = 'color-state';
        else if(service.service_category === 'JOB PORTALS') colorClass = 'color-jobs';
        else if(service.service_category === 'SCHOLARSHIPS') colorClass = 'color-scholars';
        else if(service.service_category === 'TRAVEL SERVICES') colorClass = 'color-travel';
        else if(service.service_category === 'PF & PENSION') colorClass = 'color-pension';
        else if(service.service_category === 'LAND RECORDS') colorClass = 'color-land';
        else if(service.service_category === 'BUSINESS SERVICES') colorClass = 'color-business';
        else if(service.service_category === 'UTILITY SERVICES') colorClass = 'color-utility';

        card.className = `service-card ${colorClass}`;
        // Staggered entrance animation
        card.style.animation = `fadeInUp 0.5s ease forwards ${index * 0.05}s`;
        card.style.opacity = '0';
        
        // Custom animation keyframes inline for simplicity, or in CSS
        if (!document.getElementById('keyframes')) {
            const style = document.createElement('style');
            style.id = 'keyframes';
            style.innerHTML = `
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `;
            document.head.appendChild(style);
        }

        card.innerHTML = `
            <span class="card-badge">${service.sub_category}</span>
            <h3 class="card-title">${service.service_name}</h3>
            <p class="card-desc">${service.description.substring(0, 100)}${service.description.length > 100 ? '...' : ''}</p>
            <div class="card-footer">
                <div class="fee-badge">
                    <span>Govt Fee</span>
                    <span>${service.government_fee}</span>
                </div>
                <button class="view-btn">View Details <i class="fa-solid fa-arrow-right"></i></button>
            </div>
        `;

        card.addEventListener('click', () => openModal(service));
        servicesGrid.appendChild(card);
    });
}

// Filter and Search Logic
function filterAndSearch() {
    const query = searchInput.value.toLowerCase();
    
    let filtered = allServices;
    
    if (currentCategory !== 'ALL') {
        filtered = filtered.filter(s => s.service_category === currentCategory);
    }
    
    if (query) {
        filtered = filtered.filter(s => 
            s.service_name.toLowerCase().includes(query) || 
            s.description.toLowerCase().includes(query) ||
            s.sub_category.toLowerCase().includes(query)
        );
    }
    
    renderServices(filtered);
}

// Event Listeners
searchInput.addEventListener('input', filterAndSearch);

navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        // Update active state
        navItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');
        
        // Update category
        currentCategory = item.getAttribute('data-category');
        
        // Update Title
        if(currentCategory === 'ALL') {
            currentCategoryTitle.textContent = 'All Services';
        } else {
            currentCategoryTitle.textContent = item.textContent.trim();
        }
        
        filterAndSearch();
        
        // Close sidebar on mobile
        if (window.innerWidth <= 1024) {
            sidebar.classList.remove('open');
        }
    });
});

menuToggle.addEventListener('click', () => {
    sidebar.classList.toggle('open');
});

// Modal Logic
function openModal(service) {
    modalCategory.textContent = `${service.service_category} > ${service.sub_category}`;
    modalTitle.textContent = service.service_name;
    modalDesc.textContent = service.description;
    modalGovFee.textContent = service.government_fee;
    modalServiceCharge.textContent = service.recommended_service_charge;
    // Parse documents into bullet points
    if (service.required_documents) {
        const docsArray = service.required_documents.split(',').map(d => d.trim()).filter(d => d);
        modalDocs.innerHTML = '<ul style="padding-left: 20px; margin: 0; display: flex; flex-direction: column; gap: 8px;">' + 
            docsArray.map(doc => `<li><i class="fa-solid fa-check" style="color: var(--primary); margin-right: 8px;"></i>${doc}</li>`).join('') + 
            '</ul>';
    } else {
        modalDocs.innerHTML = '<em>None specified</em>';
    }
    
    modalEligibility.textContent = service.eligibility;
    
    modalAuth.textContent = service.authorization_required;
    
    if (service.authorization_required && service.authorization_required.toLowerCase() !== 'none') {
        modalAuthContainer.style.display = 'block';
    } else {
        modalAuthContainer.style.display = 'none';
    }
    
    modalLink.href = service.official_website;
    
    modal.classList.add('active');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
}

function closeModal() {
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

closeModalBtn.addEventListener('click', closeModal);
modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
});

// Initialize
init();
