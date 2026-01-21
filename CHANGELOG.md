# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-01-21

### Added
- Add an S3-compatible upload command with support for multiple cloud storage providers.
- Add a new setup wizard that lets users configure providers and store credentials securely.
- Add a clipboard copy feature that automatically copies the uploaded file URL after transfer.
- Add a progress bar that shows upload speed and estimated time remaining during file uploads.
- Add a modern banner and optional theme settings to personalize the user interface.

## [0.1.5] - 2026-01-12



## [0.1.4] - 2026-01-11

### Added
- Users can now upload multiple files at once with the new uploadFiles function.

## [0.1.3] - 2026-01-11

### Added
- Added a finalizing callback in the upload progress interface, allowing users to be notified when an upload completes.

## [0.1.2] - 2026-01-11

### Added
- The upload process now shows progress updates to keep users informed.
- Uploads now support multipart handling, enabling reliable transfer of larger files.

