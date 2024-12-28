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

    function listFiles(prefix = '') {
        showLoading();
        const url = `/list?prefix=${encodeURIComponent(prefix)}`;
        fetch(url)
            .then(response => response.json())
            .then(data => {
                hideLoading();
                if (data.error) {
                    showMessage(data.error, 'error');
                } else {
                    updateFileList(data.files);
                    updateCurrentPath(prefix);
                }
            })
            .catch(error => {
                hideLoading();
                showMessage('Error fetching file list', 'error');
            });
    }

    function updateFileList(files) {
        fileList.innerHTML = '';
        if (currentPath) {
            const li = document.createElement('li');
            li.className = 'flex justify-between items-center py-2';
            li.innerHTML = `
                <button onclick="navigateUp()" class="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-1 px-2 rounded">
                    ../ (Up)
                </button>
            `;
            fileList.appendChild(li);
        }
        files.forEach(file => {
            if (file.type === 'folder' || (showFiles && (showHiddenFiles || !hiddenFiles.has(file.name)))) {
                const li = document.createElement('li');
                li.className = 'flex justify-between items-center py-2';
                if (file.type === 'folder') {
                    li.innerHTML = `
                        <span>${file.name}</span>
                        <div>
                            <button onclick="navigateToFolder('${file.name}')" class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-2 rounded mr-2">
                                Open
                            </button>
                            <button onclick="deleteFolder('${file.name}')" class="bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-2 rounded">
                                Delete
                            </button>
                        </div>
                    `;
                } else {
                    const isHidden = hiddenFiles.has(file.name);
                    li.innerHTML = `
                        <span>${file.name} (${formatFileSize(file.size)})</span>
                        <div>
                            ${file.preview_url ? `<button onclick="previewFile('${file.name}', '${file.preview_url}', '${file.mime_type}')" class="bg-green-500 hover:bg-green-700 text-white font-bold py-1 px-2 rounded mr-2">
                                Preview
                            </button>` : ''}
                            <button onclick="downloadFile('${file.name}')" class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-2 rounded mr-2">
                                Download
                            </button>
                            <button onclick="deleteFile('${file.name}')" class="bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-2 rounded mr-2">
                                Delete
                            </button>
                            <button onclick="toggleFileVisibility('${file.name}')" class="bg-yellow-500 hover:bg-yellow-700 text-white font-bold py-1 px-2 rounded">
                                <i class="fas ${isHidden ? 'fa-eye-slash' : 'fa-eye'}"></i>
                            </button>
                        </div>
                    `;
                }
                fileList.appendChild(li);
            }
        });
    }

    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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

    function createProgressBar(filename, type) {
        const progressBarContainer = document.createElement('div');
        progressBarContainer.className = 'mt-4';
        progressBarContainer.innerHTML = `
            <p>${type === 'upload' ? 'Uploading' : 'Downloading'} ${filename}</p>
            <div class="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                <div class="bg-blue-600 h-2.5 rounded-full" style="width: 0%"></div>
            </div>
        `;
        document.getElementById('progress-bars').appendChild(progressBarContainer);
        return progressBarContainer;
    }

    function updateProgressBar(progressBarContainer, percentComplete) {
        const progressBar = progressBarContainer.querySelector('.bg-blue-600');
        progressBar.style.width = `${percentComplete}%`;
    }

    function createCancelButton(cancelCallback) {
        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Cancel';
        cancelButton.className = 'bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-2 rounded mt-2';
        cancelButton.onclick = cancelCallback;
        return cancelButton;
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