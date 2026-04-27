document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('resources-container');
    const searchInput = document.getElementById('search-input');
    const categoryFilter = document.getElementById('category-filter');
    const sortSelect = document.getElementById('sort-select');

    // Admin panel elements (Add)
    const adminBtn = document.getElementById('admin-panel-btn');
    const adminModal = document.getElementById('admin-modal');
    const closeBtn = document.querySelector('.close-btn');
    const adminForm = document.getElementById('admin-form');
    const statusMsg = document.getElementById('admin-status');
    const saveBtn = document.getElementById('save-btn');

    // Admin mode (Edit/Delete)
    const toggleAdminModeBtn = document.getElementById('toggle-admin-mode-btn');
    let isAdminModeActive = false;

    // Delete Modal elements
    const deleteModal = document.getElementById('delete-modal');
    const closeDeleteBtn = document.querySelector('.close-delete-btn');
    const deleteForm = document.getElementById('delete-form');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    const deleteStatusMsg = document.getElementById('delete-status');
    const deleteConfirmText = document.getElementById('delete-confirm-text');
    let resourceToDeleteIndex = -1;

    let resourcesData = []; // Store original data

    // --- LocalStorage Logic for Credentials ---
    // SessionStorage вместо LocalStorage, чтобы данные удалялись при закрытии вкладки.
    const STORAGE_KEY_TOKEN = 'github_pat_token';
    const STORAGE_KEY_REPO = 'github_repo_name';

    // Load saved credentials from SessionStorage (not LocalStorage)
    const savedToken = sessionStorage.getItem(STORAGE_KEY_TOKEN) || '';
    const savedRepo = sessionStorage.getItem(STORAGE_KEY_REPO) || '';

    if (document.getElementById('github-token')) document.getElementById('github-token').value = savedToken;
    if (document.getElementById('github-repo')) document.getElementById('github-repo').value = savedRepo;
    if (document.getElementById('del-github-token')) document.getElementById('del-github-token').value = savedToken;
    if (document.getElementById('del-github-repo')) document.getElementById('del-github-repo').value = savedRepo;

    function saveCredentials(token, repo) {
        // Сохраняем только в sessionStorage (до закрытия вкладки)
        sessionStorage.setItem(STORAGE_KEY_TOKEN, token);
        sessionStorage.setItem(STORAGE_KEY_REPO, repo);

        // Sync both forms
        if (document.getElementById('github-token')) document.getElementById('github-token').value = token;
        if (document.getElementById('github-repo')) document.getElementById('github-repo').value = repo;
        if (document.getElementById('del-github-token')) document.getElementById('del-github-token').value = token;
        if (document.getElementById('del-github-repo')) document.getElementById('del-github-repo').value = repo;
    }


    // --- Core Loading and Display Functions ---

    async function loadData() {
        try {
            // Если у нас есть токен и репо, попробуем загрузить данные НАПРЯМУЮ через GitHub API,
            // чтобы обойти 1-минутный кэш GitHub Pages.
            // Если нет токена - загружаем обычный data.json
            let useDirectGithubApi = false;

            // ПРОВЕРКА: Делаем запрос к API только если есть токен и он похож на валидный
            // (ghp_ или github_pat_ обычно используются)
            if (savedToken && savedRepo && savedToken.length > 10) {
                try {
                    const githubApiUrl = `https://api.github.com/repos/${savedRepo}/contents/data.json`;
                    const apiResponse = await fetch(githubApiUrl, {
                        method: 'GET',
                        headers: {
                            'Authorization': `token ${savedToken}`,
                            'Accept': 'application/vnd.github.v3+json',
                            'Cache-Control': 'no-cache'
                        }
                    });

                    if (apiResponse.ok) {
                        const fileData = await apiResponse.json();
                        const decodedContent = decodeURIComponent(escape(atob(fileData.content)));
                        resourcesData = JSON.parse(decodedContent);
                        useDirectGithubApi = true;
                    } else {
                        // Если API ответил ошибкой (например, 401 из-за неверного/устаревшего токена),
                        // не падаем, а переключаемся на загрузку обычного файла
                        console.warn(`GitHub API request failed with status: ${apiResponse.status}. Falling back to normal JSON load.`);
                    }
                } catch (e) {
                    console.log("Direct API load failed, falling back to static file", e);
                }
            }

            if (!useDirectGithubApi) {
                // Если мы тестируем локально (file://), fetch не работает на локальные файлы без сервера.
                // Нам нужно определить, находимся ли мы на file:// протоколе.
                const isFileProtocol = window.location.protocol === 'file:';

                let jsonUrl = `data.json?t=${new Date().getTime()}`;

                // Для file:// протокола параметры URL (?t=...) ломают запрос (Failed to fetch).
                // И сам fetch может быть заблокирован CORS политикой браузера для file://.
                if (isFileProtocol) {
                    jsonUrl = 'data.json';
                }

                try {
                    const response = await fetch(jsonUrl);
                    if (!response.ok) throw new Error(`Loading error: ${response.status}`);
                    resourcesData = await response.json();
                } catch(fetchError) {
                    // Если мы локально открыли файл в браузере (file://...) и fetch упал (CORS),
                    // мы должны показать пользователю понятную ошибку.
                    if(isFileProtocol) {
                        throw new Error(`Browser blocked local file access. Please use 'Live Server' or 'python -m http.server'.`);
                    } else {
                        throw fetchError;
                    }
                }
            }

            populateCategories(resourcesData);
            updateDisplay();
        } catch (error) {
            console.error('Error:', error);
            container.innerHTML = `<p style="color: #ef4444; text-align:center; grid-column: 1/-1;">
                <strong>Failed to load data.</strong><br>
                ${error.message}<br>
                <em>If you are opening index.html directly from a folder, you need to run a local server (e.g. using VS Code Live Server).</em>
            </p>`;
        }
    }

    function populateCategories(data) {
        const currentSelection = categoryFilter.value;
        categoryFilter.innerHTML = '<option value="all">All Categories</option>';
        const uniqueCategories = [...new Set(data.map(item => item.tag))].sort();

        uniqueCategories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            categoryFilter.appendChild(option);
        });

        if (uniqueCategories.includes(currentSelection) || currentSelection === 'all') {
            categoryFilter.value = currentSelection;
        }
    }

    function updateDisplay() {
        const searchTerm = searchInput.value.toLowerCase();
        const selectedCategory = categoryFilter.value;
        const sortMode = sortSelect.value;

        let filteredData = resourcesData.map((item, originalIndex) => ({...item, originalIndex}))
            .filter(item => {
                const matchesSearch = item.title.toLowerCase().includes(searchTerm) ||
                                      item.description.toLowerCase().includes(searchTerm);
                const matchesCategory = selectedCategory === 'all' || item.tag === selectedCategory;
                return matchesSearch && matchesCategory;
            });

        if (sortMode === 'name-asc') {
            filteredData.sort((a, b) => a.title.localeCompare(b.title));
        } else if (sortMode === 'name-desc') {
            filteredData.sort((a, b) => b.title.localeCompare(a.title));
        }

        renderCards(filteredData);
    }

    function renderCards(data) {
        container.innerHTML = '';

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
                <div class="card-header">
                    <span class="${tagClass}" data-type="${tagType}">${item.tag}</span>
                    <button class="delete-btn" aria-label="Delete resource" data-index="${item.originalIndex}">
                        🗑️
                    </button>
                </div>
                <h2>${item.title}</h2>
                <p>${item.description}</p>
                <a href="${item.url}" target="_blank" rel="noopener noreferrer">Visit Website</a>
            `;

            container.appendChild(card);
        });

        // Add event listeners to newly created delete buttons
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = e.currentTarget.getAttribute('data-index');
                openDeleteModal(index);
            });
        });
    }

    // --- Admin Mode Toggle ---
    if(toggleAdminModeBtn) {
        toggleAdminModeBtn.addEventListener('click', () => {
            isAdminModeActive = !isAdminModeActive;
            if(isAdminModeActive) {
                document.body.classList.add('admin-mode-active');
                toggleAdminModeBtn.style.backgroundColor = '#ef4444';
                toggleAdminModeBtn.textContent = 'Exit Edit Mode';
            } else {
                document.body.classList.remove('admin-mode-active');
                toggleAdminModeBtn.style.backgroundColor = '#64748b';
                toggleAdminModeBtn.textContent = 'Edit Mode';
            }
        });
    }

    // --- Modals Logic ---
    window.onclick = (event) => {
        if (event.target == adminModal) {
            adminModal.style.display = "none";
            resetAdminForm();
        }
        if (event.target == deleteModal) {
            deleteModal.style.display = "none";
            resetDeleteForm();
        }
    };

    // --- ADD Resource Logic ---
    if(adminBtn) adminBtn.onclick = () => { adminModal.style.display = "block"; };
    if(closeBtn) closeBtn.onclick = () => { adminModal.style.display = "none"; resetAdminForm(); };

    function resetAdminForm() {
        if(!statusMsg) return;
        statusMsg.textContent = '';
        statusMsg.className = 'status-msg';
        saveBtn.disabled = false;
        saveBtn.textContent = 'Push to GitHub';
    }

    if(adminForm) {
        adminForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            saveBtn.disabled = true;
            saveBtn.textContent = 'Pushing...';

            const token = document.getElementById('github-token').value.trim();
            const repo = document.getElementById('github-repo').value.trim();

            const newResource = {
                title: document.getElementById('res-title').value.trim(),
                description: document.getElementById('res-desc').value.trim(),
                url: document.getElementById('res-url').value.trim(),
                tag: document.getElementById('res-tag').value.trim()
            };

            saveCredentials(token, repo);

            await updateGithubData(token, repo, (currentJson) => {
                currentJson.unshift(newResource);
                return currentJson;
            }, `Add new resource: ${newResource.title}`, statusMsg, saveBtn, 'Push to GitHub', () => {
                resourcesData.unshift(newResource);
                populateCategories(resourcesData);
                updateDisplay();

                // Clear input fields but leave token/repo
                document.getElementById('res-title').value = '';
                document.getElementById('res-desc').value = '';
                document.getElementById('res-url').value = '';
                document.getElementById('res-tag').value = '';

                setTimeout(() => { adminModal.style.display = "none"; resetAdminForm(); }, 1500);
            });
        });
    }

    // --- DELETE Resource Logic ---
    function openDeleteModal(index) {
        resourceToDeleteIndex = parseInt(index);
        const resource = resourcesData[resourceToDeleteIndex];
        deleteConfirmText.innerHTML = `Are you sure you want to delete <strong>${resource.title}</strong>?`;
        deleteModal.style.display = "block";
    }

    if(closeDeleteBtn) closeDeleteBtn.onclick = () => { deleteModal.style.display = "none"; resetDeleteForm(); };

    function resetDeleteForm() {
        deleteStatusMsg.textContent = '';
        deleteStatusMsg.className = 'status-msg';
        confirmDeleteBtn.disabled = false;
        confirmDeleteBtn.textContent = 'Delete from GitHub';
        resourceToDeleteIndex = -1;
    }

    if(deleteForm) {
        deleteForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if(resourceToDeleteIndex === -1) return;

            confirmDeleteBtn.disabled = true;
            confirmDeleteBtn.textContent = 'Deleting...';

            const token = document.getElementById('del-github-token').value.trim();
            const repo = document.getElementById('del-github-repo').value.trim();
            const resourceTitle = resourcesData[resourceToDeleteIndex].title;

            saveCredentials(token, repo);

            await updateGithubData(token, repo, (currentJson) => {
                currentJson.splice(resourceToDeleteIndex, 1);
                return currentJson;
            }, `Delete resource: ${resourceTitle}`, deleteStatusMsg, confirmDeleteBtn, 'Delete from GitHub', () => {
                resourcesData.splice(resourceToDeleteIndex, 1);
                populateCategories(resourcesData);
                updateDisplay();
                setTimeout(() => { deleteModal.style.display = "none"; resetDeleteForm(); }, 1500);
            });
        });
    }

    // --- Unified GitHub API Function ---
    async function updateGithubData(token, repo, dataModifierFunc, commitMessage, statusElement, btnElement, originalBtnText, onSuccess) {
        const filePath = 'data.json';
        const githubApiUrl = `https://api.github.com/repos/${repo}/contents/${filePath}`;

        function showStatus(msg, isError = false) {
            statusElement.textContent = msg;
            statusElement.className = `status-msg ${isError ? 'status-error' : 'status-success'}`;
        }

        try {
            showStatus('Fetching current data from GitHub...', false);

            const getResponse = await fetch(githubApiUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Cache-Control': 'no-cache'
                }
            });

            if (!getResponse.ok) {
                if (getResponse.status === 404) throw new Error("data.json not found in the repository.");
                if (getResponse.status === 401 || getResponse.status === 403) throw new Error("Authentication failed.");
                throw new Error(`GitHub API Error: ${getResponse.statusText}`);
            }

            const fileData = await getResponse.json();
            const fileSha = fileData.sha;

            const decodedContent = decodeURIComponent(escape(atob(fileData.content)));
            let currentJson = JSON.parse(decodedContent);

            // Modify data (Add or Delete)
            currentJson = dataModifierFunc(currentJson);

            const updatedContentStr = JSON.stringify(currentJson, null, 2);
            const encodedContent = btoa(unescape(encodeURIComponent(updatedContentStr)));

            showStatus('Pushing updated file to GitHub...', false);

            const putResponse = await fetch(githubApiUrl, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message: commitMessage, content: encodedContent, sha: fileSha })
            });

            if (!putResponse.ok) {
                const errData = await putResponse.json();
                throw new Error(`Failed to update file: ${errData.message}`);
            }

            showStatus('Successfully saved to GitHub!', false);
            onSuccess();

        } catch (error) {
            console.error(error);
            showStatus(error.message, true);
        } finally {
            btnElement.disabled = false;
            btnElement.textContent = originalBtnText;
        }
    }

    // --- Event Listeners for controls ---
    if(searchInput) searchInput.addEventListener('input', updateDisplay);
    if(categoryFilter) categoryFilter.addEventListener('change', updateDisplay);
    if(sortSelect) sortSelect.addEventListener('change', updateDisplay);

    loadData();
});