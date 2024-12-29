# S3 File Share GUI

A modern web application for easily sharing and managing files using Amazon S3 storage with a clean and intuitive user interface.

![S3 File Share GUI Screenshot](static/img/screenshot.png)

## Features

- 📁 Intuitive file and folder management
- 🔄 Drag-and-drop file uploads
- 🔗 Secure file sharing with temporary URLs
- 📱 Responsive design for mobile and desktop
- 🎯 Real-time upload progress tracking
- 🗂️ Folder creation and hierarchical navigation
- 🔍 File search and filtering
- 🔒 Secure file handling with AWS S3

## Getting Started

### Prerequisites

- Python 3.10 or higher
- AWS Account with S3 access
- Poetry for dependency management

### Installation

1. Clone the repository: 
```bash
git clone https://github.com/rohitg00/s3-file-share-for-free.git
cd s3-file-share-for-free
```
2. Running Application using poetry:
- Install dependencies:
```bash
poetry install
```
- Start the application:
```bash
poetry run python app.py
```
3. Running Application using PIP:
- Install dependencies:
```bash
pip install -r requirements.txt
```
- Start the application:
```bash
python app.py
```

4. Open your browser and navigate to `http://localhost:5001` to access the application.

5. Configure AWS credentials through the web interface:
   - Click "Configure S3" button
   - Enter your AWS Access Key ID
   - Enter your AWS Secret Access Key
   - Enter your S3 Bucket name
   - Enter your preferred AWS Region (default: us-east-1)
   - Click "Save" button

## Usage

### File Upload
- Drag and drop files into the upload area
- Click "Upload" button to select files manually
- Monitor upload progress in real-time

### File Management
- Create folders using the "New Folder" button
- Navigate through folders by clicking
- Delete files/folders using the delete icon
- Download files directly from the interface

### File Sharing
- Generate shareable links with custom expiration
- Copy links to clipboard with one click
- Set access permissions for shared files

## Architecture

The application uses:
- Flask for the backend server
- AWS S3 for file storage
- Modern JavaScript for frontend interactivity
- Bootstrap for responsive design

## Technical Details

- Backend: Python Flask
- Frontend: JavaScript, Tailwind CSS
- Storage: Amazon S3
- File Upload: Chunked upload for large files
- Preview Support: Images, PDFs, Videos
- Security: Server-side AWS credential management

## Security Features

- Secure file handling
- AWS IAM best practices
- Input validation and sanitization
- Temporary URL generation
- Access control implementation

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- AWS SDK for Python (Boto3)
- Flask web framework
- Bootstrap CSS framework
- Neon cloud icon design for favicon

## Support

For support, please open an issue in the GitHub repository or contact [email here](ghumare64@gmail.com)

---

Made with ❤️ by Rohit Ghumare
