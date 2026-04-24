document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('resources-container');
    const searchInput = document.getElementById('search-input');
    const categoryFilter = document.getElementById('category-filter');
    const sortSelect = document.getElementById('sort-select');

    let resourcesData = []; // Store original data

    // Function to load data from JSON
    async function loadData() {
        try {
            const response = await fetch('data.json');
            if (!response.ok) {
                throw new Error(`Loading error: ${response.status}`);
            }

            resourcesData = await response.json();

            // Populate category dropdown
            populateCategories(resourcesData);

            // Initial render
            renderCards(resourcesData);

        } catch (error) {
            console.error('Error:', error);
            container.innerHTML = `<p style="color: #ef4444; text-align:center; grid-column: 1/-1;">Failed to load data. Please make sure the local server is running.</p>`;
        }
    }

    // Extract unique categories and add to select dropdown
    function populateCategories(data) {
        const uniqueCategories = [...new Set(data.map(item => item.tag))].sort();

        uniqueCategories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            categoryFilter.appendChild(option);
        });
    }

    // Main function to filter, sort and render cards
    function updateDisplay() {
        const searchTerm = searchInput.value.toLowerCase();
        const selectedCategory = categoryFilter.value;
        const sortMode = sortSelect.value;

        // 1. Filter
        let filteredData = resourcesData.filter(item => {
            const matchesSearch = item.title.toLowerCase().includes(searchTerm) ||
                                  item.description.toLowerCase().includes(searchTerm);
            const matchesCategory = selectedCategory === 'all' || item.tag === selectedCategory;

            return matchesSearch && matchesCategory;
        });

        // 2. Sort
        if (sortMode === 'name-asc') {
            filteredData.sort((a, b) => a.title.localeCompare(b.title));
        } else if (sortMode === 'name-desc') {
            filteredData.sort((a, b) => b.title.localeCompare(a.title));
        }
        // If sortMode === 'default', we keep the original JSON order (since filter doesn't mutate original array order)

        // 3. Render
        renderCards(filteredData);
    }

    // Function to render HTML cards
    function renderCards(data) {
        container.innerHTML = ''; // Clear container

        if (data.length === 0) {
            container.innerHTML = '<div class="no-results">No resources found matching your criteria.</div>';
            return;
        }

        data.forEach(item => {
            const card = document.createElement('div');
            card.className = 'card';

            const tagType = item.tag.startsWith('AI') ? 'AI' : item.tag;
            const isDefault = !['AI', 'Tools', 'Debugging', 'Visualization'].includes(tagType);
            const tagClass = isDefault ? 'tag default' : 'tag';

            card.innerHTML = `
                <span class="${tagClass}" data-type="${tagType}">${item.tag}</span>
                <h2>${item.title}</h2>
                <p>${item.description}</p>
                <a href="${item.url}" target="_blank" rel="noopener noreferrer">Visit Website</a>
            `;

            container.appendChild(card);
        });
    }

    // Event Listeners for controls
    searchInput.addEventListener('input', updateDisplay);
    categoryFilter.addEventListener('change', updateDisplay);
    sortSelect.addEventListener('change', updateDisplay);

    // Call the function when the page loads
    loadData();
});