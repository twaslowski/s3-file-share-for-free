document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const fileList = document.getElementById('file-list');
    const messageDiv = document.getElementById('message');
    const loadingSpinner = document.getElementById('loading-spinner');
    const previewArea = document.getElementById('preview-area');
    const createFolderBtn = document.getElementById('create-folder-btn');
    const currentPathDiv = document.getElementById('current-path');
    const toggleFilesBtn = document.getElementById('toggle-files-btn');
    const toggleMenu = document.getElementById('toggle-menu');
    const showHiddenFilesCheckbox = document.getElementById('show-hidden-files');

    let currentPath = '';
    let showFiles = true;
    let hiddenFiles = new Set();
    let showHiddenFiles = false;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, unhighlight, false);
    });

    function highlight() {
        dropZone.classList.add('highlight');
    }

    function unhighlight() {
        dropZone.classList.remove('highlight');
    }

    dropZone.addEventListener('drop', handleDrop, false);

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    }

    fileInput.addEventListener('change', function() {
        handleFiles(this.files);
    });

    function handleFiles(files) {
        ([...files]).forEach(uploadFile);
    }

    async function uploadFile(file) {
        const chunkSize = 100 * 1024 * 1024;
        const filename = currentPath + file.name;

        const progressBarContainer = createProgressBar(file.name, 'upload');
        const cancelButton = createCancelButton(() => {
            progressBarContainer.remove();
            showMessage('Upload cancelled', 'info');
        });
        progressBarContainer.appendChild(cancelButton);

        if (file.size < chunkSize) {
            const formData = new FormData();
            formData.append('chunk', file);
            formData.append('filename', filename);
            formData.append('file_size', file.size);
            formData.append('chunk_number', 0);
            formData.append('total_chunks', 1);

            try {
                const response = await fetch('/upload_chunk', {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
                }

                progressBarContainer.remove();
                showMessage('File uploaded successfully', 'success');
                listFiles(currentPath);
            } catch (error) {
                showMessage(`Error uploading file: ${error.message}`, 'error');
                console.error('Upload error:', error);
                progressBarContainer.remove();
            }
        } else {
            const chunks = Math.ceil(file.size / chunkSize);
            let uploadId;

            for (let chunk = 0; chunk < chunks; chunk++) {
                const formData = new FormData();
                formData.append('chunk', file.slice(chunk * chunkSize, (chunk + 1) * chunkSize));
                formData.append('filename', filename);
                formData.append('chunk_number', chunk);
                formData.append('total_chunks', chunks);
                formData.append('file_size', file.size);
                if (uploadId) {
                    formData.append('upload_id', uploadId);
                }

                try {
                    const response = await fetch('/upload_chunk', {
                        method: 'POST',
                        body: formData
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
                    }

                    const result = await response.json();
                    if (result.upload_id) {
                        uploadId = result.upload_id;
                    }

                    const percentComplete = ((chunk + 1) / chunks) * 100;
                    updateProgressBar(progressBarContainer, percentComplete);

                } catch (error) {
                    showMessage(`Error uploading file: ${error.message}`, 'error');
                    console.error('Upload error:', error);
                    progressBarContainer.remove();
                    return;
                }
            }

            progressBarContainer.remove();
            showMessage('File uploaded successfully', 'success');
            listFiles(currentPath);
        }
    }

    async function fetchFileList(prefix = '') {
        try {
            const response = await fetch(`/list?prefix=${encodeURIComponent(prefix)}`);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Error fetching file list');
            }

            // Check if we have a message indicating S3 is not configured
            if (data.message === 'S3 not configured') {
                const fileList = document.getElementById('fileList');
                fileList.innerHTML = `
                    <div class="text-center p-8">
                        <p class="text-gray-500 mb-4">S3 is not configured</p>
                        <a href="/configure" class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
                            Configure S3
                        </a>
                    </div>
                `;
                return;
            }

            displayFiles(data.files || []);
        } catch (error) {
            console.error('Error:', error);
            const fileList = document.getElementById('fileList');
            fileList.innerHTML = `
                <div class="text-center p-8">
                    <p class="text-red-500 mb-4">Error fetching file list: ${error.message}</p>
                    <button onclick="fetchFileList()" class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
                        Retry
                    </button>
                </div>
            `;
        }
    }

    function displayFiles(files) {
        const fileList = document.getElementById('fileList');
        if (files.length === 0) {
            fileList.innerHTML = `
                <div class="text-center p-8 text-gray-500">
                    No files found
                </div>
            `;
            return;
        }

        // Rest of your existing displayFiles code...
    }

    async function listFiles(prefix = '') {
        showLoading();
        try {
            const response = await fetch(`/list?prefix=${encodeURIComponent(prefix)}`);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Error fetching file list');
            }

            // Check if S3 is not configured
            if (data.message === 'S3 not configured') {
                fileList.innerHTML = `
                    <div class="text-center p-8">
                        <p class="text-gray-500 mb-4">S3 is not configured</p>
                        <a href="/configure" class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
                            Configure S3
                        </a>
                    </div>
                `;
                return;
            }

            // Update current path display
            updateCurrentPath(prefix);

            // Clear existing file list
            fileList.innerHTML = '';

            // Add "Up" button if not in root
            if (prefix) {
                const upButton = document.createElement('div');
                upButton.className = 'mb-4';
                upButton.innerHTML = `
                    <button onclick="navigateUp()" class="bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-2 px-4 rounded inline-flex items-center">
                        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11l5-5m0 0l5 5m-5-5v12"/>
                        </svg>
                        Back to Parent
                    </button>
                `;
                fileList.appendChild(upButton);
            }

            // Create grid container
            const gridContainer = document.createElement('div');
            gridContainer.className = 'grid grid-cols-1 gap-2';
            fileList.appendChild(gridContainer);

            // Display files and folders
            data.files.forEach(item => {
                const isHidden = hiddenFiles.has(item.name);
                if (isHidden && !showHiddenFiles) return;

                const itemElement = document.createElement('div');
                itemElement.className = `
                    flex items-center justify-between p-3 rounded-lg
                    ${isHidden ? 'opacity-50' : ''}
                    ${item.type === 'folder' ? 'bg-blue-50 hover:bg-blue-100' : 'bg-white hover:bg-gray-50'}
                    border border-gray-200 shadow-sm hover:shadow transition-all duration-200
                `;

                const fileName = item.name.split('/').pop(); // Get just the filename without the path

                if (item.type === 'folder') {
                    itemElement.innerHTML = `
                        <div class="flex items-center flex-grow cursor-pointer" onclick="navigateToFolder('${item.name}')">
                            <svg class="w-6 h-6 mr-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
                            </svg>
                            <span class="font-medium text-gray-700">${fileName}</span>
                        </div>
                        <div class="flex items-center space-x-2">
                            <button onclick="event.stopPropagation(); deleteFolder('${item.name}')" 
                                    class="p-1 hover:bg-red-100 rounded-full" title="Delete folder">
                                <svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                                </svg>
                            </button>
                            <button onclick="event.stopPropagation(); toggleFileVisibility('${item.name}')" 
                                    class="p-1 hover:bg-gray-100 rounded-full" title="Toggle visibility">
                                <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${isHidden ? 
                                        'M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21' :
                                        'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z'}"/>
                                </svg>
                            </button>
                        </div>
                    `;
                } else {
                    const fileSize = formatFileSize(item.size);
                    const previewButton = item.preview_url ? `
                        <button onclick="previewFile('${item.name}', '${item.preview_url}', '${item.mime_type}')"
                                class="p-1 hover:bg-blue-100 rounded-full" title="Preview file">
                            <svg class="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                            </svg>
                        </button>
                    ` : '';

                    itemElement.innerHTML = `
                        <div class="flex items-center flex-grow">
                            ${getFileIconSVG(item.mime_type)}
                            <div class="ml-3">
                                <div class="font-medium text-gray-700">${fileName}</div>
                                <div class="text-sm text-gray-500">${fileSize}</div>
                            </div>
                        </div>
                        <div class="flex items-center space-x-2">
                            ${previewButton}
                            <a href="/download/${encodeURIComponent(item.name)}" 
                               class="p-1 hover:bg-green-100 rounded-full" title="Download file">
                                <svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                                </svg>
                            </a>
                            <button onclick="deleteFile('${item.name}')"
                                    class="p-1 hover:bg-red-100 rounded-full" title="Delete file">
                                <svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                                </svg>
                            </button>
                            <button onclick="toggleFileVisibility('${item.name}')"
                                    class="p-1 hover:bg-gray-100 rounded-full" title="Toggle visibility">
                                <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${isHidden ? 
                                        'M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21' :
                                        'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z'}"/>
                                </svg>
                            </button>
                        </div>
                    `;
                }

                gridContainer.appendChild(itemElement);
            });

            if (gridContainer.children.length === 0) {
                fileList.innerHTML = `
                    <div class="text-center p-8">
                        <div class="text-gray-500">No files found</div>
                    </div>
                `;
            }

        } catch (error) {
            console.error('Error:', error);
            fileList.innerHTML = `
                <div class="text-center p-8">
                    <p class="text-red-500 mb-4">Error fetching file list: ${error.message}</p>
                    <button onclick="listFiles('${prefix}')" 
                            class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
                        Retry
                    </button>
                </div>
            `;
        } finally {
            hideLoading();
        }
    }

    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function getFileIconSVG(mimeType) {
        const baseClass = 'w-6 h-6';
        if (!mimeType) {
            return `<svg class="${baseClass} text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
            </svg>`;
        }
        if (mimeType.startsWith('image/')) {
            return `<svg class="${baseClass} text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>`;
        }
        if (mimeType.startsWith('video/')) {
            return `<svg class="${baseClass} text-pink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
            </svg>`;
        }
        if (mimeType === 'application/pdf') {
            return `<svg class="${baseClass} text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
            </svg>`;
        }
        return `<svg class="${baseClass} text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
        </svg>`;
    }

    window.downloadFile = function(filename) {
        const progressBarContainer = createProgressBar(filename, 'download');
        const abortController = new AbortController();
        const cancelButton = createCancelButton(() => {
            abortController.abort();
            progressBarContainer.remove();
            showMessage('Download cancelled', 'info');
        });
        progressBarContainer.appendChild(cancelButton);
        
        fetch(`/download/${encodeURIComponent(currentPath + filename)}`, { signal: abortController.signal })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                const reader = response.body.getReader();
                const contentLength = +response.headers.get('Content-Length');
                let receivedLength = 0;

                return new Response(
                    new ReadableStream({
                        start(controller) {
                            function push() {
                                reader.read().then(({ done, value }) => {
                                    if (done) {
                                        controller.close();
                                        progressBarContainer.remove();
                                        return;
                                    }
                                    receivedLength += value.length;
                                    const percentComplete = (receivedLength / contentLength) * 100;
                                    updateProgressBar(progressBarContainer, percentComplete);
                                    controller.enqueue(value);
                                    push();
                                });
                            }
                            push();
                        }
                    })
                );
            })
            .then(response => response.blob())
            .then(blob => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
            })
            .catch(error => {
                if (error.name === 'AbortError') {
                    showMessage('Download cancelled', 'info');
                } else {
                    showMessage('Error downloading file', 'error');
                    console.error('Download error:', error);
                }
                progressBarContainer.remove();
            });
    }

    window.deleteFile = function(filename) {
        if (confirm(`Are you sure you want to delete ${filename}?`)) {
            fetch(`/delete/${encodeURIComponent(currentPath + filename)}`, { method: 'DELETE' })
                .then(response => response.json())
                .then(data => {
                    if (data.error) {
                        showMessage(data.error, 'error');
                    } else {
                        showMessage('File deleted successfully', 'success');
                        listFiles(currentPath);
                    }
                })
                .catch(error => {
                    showMessage('Error deleting file', 'error');
                    console.error('Delete error:', error);
                });
        }
    }

    window.previewFile = function(filename, previewUrl, mimeType) {
        console.log('Previewing file:', filename, 'URL:', previewUrl, 'MIME:', mimeType);
        previewArea.innerHTML = '';
        if (mimeType.startsWith('image/')) {
            previewArea.innerHTML = `<img src="${previewUrl}" alt="${filename}" class="max-w-full h-auto">`;
        } else if (mimeType === 'application/pdf') {
            previewArea.innerHTML = `<iframe src="${previewUrl}" width="100%" height="600px"></iframe>`;
        } else if (mimeType.startsWith('video/')) {
            previewArea.innerHTML = `
                <video width="100%" height="auto" controls>
                    <source src="${previewUrl}" type="${mimeType}">
                    Your browser does not support the video tag.
                </video>`;
        } else {
            previewArea.innerHTML = '<p>Preview not available for this file type.</p>';
        }
    }

    function showMessage(message, type) {
        messageDiv.textContent = message;
        messageDiv.className = type === 'error' ? 'text-red-500' : type === 'info' ? 'text-blue-500' : 'text-green-500';
        setTimeout(() => {
            messageDiv.textContent = '';
            messageDiv.className = '';
        }, 5000);
    }

    function showLoading() {
        loadingSpinner.classList.remove('hidden');
    }

    function hideLoading() {
        loadingSpinner.classList.add('hidden');
    }

    function createProgressBar(filename, type = 'upload') {
        const progressBarContainer = document.createElement('div');
        progressBarContainer.className = 'mb-4 p-4 bg-white rounded-lg shadow animate-fade-in';
        
        progressBarContainer.innerHTML = `
            <div class="flex justify-between items-center mb-2">
                <span class="text-sm font-medium text-gray-700">${type === 'upload' ? 'Uploading' : 'Downloading'}: ${filename}</span>
                <span class="text-sm text-gray-500 progress-percentage">0%</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-2.5">
                <div class="bg-blue-600 h-2.5 rounded-full transition-all duration-300" style="width: 0%"></div>
            </div>
        `;
        
        const progressBarsContainer = document.getElementById('progress-bars');
        progressBarsContainer.appendChild(progressBarContainer);
        return progressBarContainer;
    }

    function updateProgressBar(container, percentage) {
        const progressBar = container.querySelector('.bg-blue-600');
        const percentageText = container.querySelector('.progress-percentage');
        
        if (progressBar && percentageText) {
            progressBar.style.width = `${percentage}%`;
            percentageText.textContent = `${Math.round(percentage)}%`;
        }
    }

    function createCancelButton(onCancel) {
        const button = document.createElement('button');
        button.className = 'mt-2 px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors text-sm';
        button.textContent = 'Cancel';
        button.onclick = onCancel;
        return button;
    }

    createFolderBtn.addEventListener('click', () => {
        const folderName = prompt('Enter folder name:');
        if (folderName) {
            createFolder(folderName);
        }
    });

    function createFolder(folderName) {
        const fullPath = currentPath + folderName;
        fetch('/create_folder', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ folder_name: fullPath }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                showMessage(data.error, 'error');
            } else {
                showMessage('Folder created successfully', 'success');
                listFiles(currentPath);
            }
        })
        .catch(error => {
            showMessage('Error creating folder', 'error');
            console.error('Create folder error:', error);
        });
    }

    window.deleteFolder = function(folderName) {
        if (confirm(`Are you sure you want to delete the folder ${folderName} and all its contents?`)) {
            const fullPath = currentPath + folderName;
            fetch(`/delete_folder/${encodeURIComponent(fullPath)}`, { method: 'DELETE' })
                .then(response => response.json())
                .then(data => {
                    if (data.error) {
                        showMessage(data.error, 'error');
                    } else {
                        showMessage('Folder deleted successfully', 'success');
                        listFiles(currentPath);
                    }
                })
                .catch(error => {
                    showMessage('Error deleting folder', 'error');
                    console.error('Delete folder error:', error);
                });
        }
    }

    window.navigateToFolder = function(folderName) {
        currentPath += folderName;
        listFiles(currentPath);
    }

    window.navigateUp = function() {
        const parts = currentPath.split('/');
        parts.pop();
        parts.pop();
        currentPath = parts.join('/') + '/';
        listFiles(currentPath);
    }

    function updateCurrentPath(path) {
        currentPathDiv.textContent = `Current Path: ${path || 'Root'}`;
        currentPath = path;
    }

    toggleFilesBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleMenu.classList.toggle('show');
    });

    document.addEventListener('click', (e) => {
        if (!toggleFilesBtn.contains(e.target) && !toggleMenu.contains(e.target)) {
            toggleMenu.classList.remove('show');
        }
    });

    showHiddenFilesCheckbox.addEventListener('change', () => {
        showHiddenFiles = showHiddenFilesCheckbox.checked;
        listFiles(currentPath);
    });

    window.toggleFileVisibility = function(filename) {
        if (hiddenFiles.has(filename)) {
            hiddenFiles.delete(filename);
        } else {
            hiddenFiles.add(filename);
        }
        listFiles(currentPath);
    }

    listFiles();
});