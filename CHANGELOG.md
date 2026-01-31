# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.1] - 2026-01-31



## [0.3.0] - 2026-01-31

### Added
- Add `list` command to display S3 objects in a table format.
- Add `prune` command that removes old or stale objects from S3.
- Add automatic archive creation for new uploads.

### Changed
- Improve upload output to show progress bars and a final summary.
- Enhance list output to display object size and last‑modified timestamps.
- Update prune command to include a preview mode before deletion.

## [0.2.2] - 2026-01-22

### Added
- Add support for multipart uploads, enabling upload of large files in smaller parts.  
- Add state persistence for multipart uploads, allowing uploads to resume after interruptions.  
- Add a progress bar that tracks multipart uploads automatically.  
- Add speed presets to help you control multipart upload speed.  

### Changed
- Improve the progress bar to update more quickly and accurately.  
- Consolidate configuration secrets into a single location for easier management.

## [0.2.1] - 2026-01-21

### Added
- Add Content-Disposition header to uploads for correct attachment handling

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

