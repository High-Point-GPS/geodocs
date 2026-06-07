import React, { useState, useEffect, useCallback } from 'react';
import {
	Dialog,
	Box,
	Typography,
	IconButton,
	Button,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import DownloadIcon from '@mui/icons-material/Download';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';

import { getFileTypeMeta } from '../utils/formatter';
import Spinner from './Spinner';

const READ_ENDPOINT = 'https://us-central1-geotabfiles.cloudfunctions.net/readDocFile';

const FilePreview = ({ files, index, onClose, onNavigate, database, session, server, onValidationError }) => {
	const open = index !== null && index !== undefined && index >= 0 && index < (files?.length || 0);
	const file = open ? files[index] : null;

	const [blobUrl, setBlobUrl] = useState(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(null);
	const [zoom, setZoom] = useState(1);

	const meta = file ? getFileTypeMeta(file.fileName) : null;
	const isImage = meta?.kind === 'image';
	const isPdf = meta?.kind === 'pdf';

	const hasPrev = open && index > 0;
	const hasNext = open && index < files.length - 1;

	const goPrev = useCallback(() => { if (hasPrev) onNavigate(index - 1); }, [hasPrev, index, onNavigate]);
	const goNext = useCallback(() => { if (hasNext) onNavigate(index + 1); }, [hasNext, index, onNavigate]);

	// Fetch the file blob whenever the previewed file changes.
	useEffect(() => {
		if (!open || !file) return undefined;

		let cancelled = false;
		let createdUrl = null;

		setLoading(true);
		setError(null);
		setZoom(1);
		setBlobUrl(null);

		(async () => {
			try {
				const sessionInfo = {
					database,
					sessionId: session.sessionId,
					userName: session.userName,
					server,
				};

				const response = await fetch(READ_ENDPOINT, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
					body: JSON.stringify({ session: sessionInfo, filePath: file.path, fileName: file.fileName }),
				});

				if (!response.ok) {
					const errData = await response.json().catch(() => ({}));
					if (errData.valid === false && onValidationError) onValidationError();
					throw new Error(errData.error || 'Unable to load this file.');
				}

				const blob = await response.blob();
				if (cancelled) return;
				createdUrl = URL.createObjectURL(blob);
				setBlobUrl(createdUrl);
			} catch (err) {
				if (!cancelled) setError(err.message || 'Unable to load this file.');
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();

		return () => {
			cancelled = true;
			if (createdUrl) URL.revokeObjectURL(createdUrl);
		};
	}, [open, file && file.id, file && file.path]);

	// Keyboard navigation.
	useEffect(() => {
		if (!open) return undefined;
		const onKey = (e) => {
			if (e.key === 'ArrowLeft') goPrev();
			else if (e.key === 'ArrowRight') goNext();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [open, goPrev, goNext]);

	const handleDownload = () => {
		if (!blobUrl || !file) return;
		const link = document.createElement('a');
		link.href = blobUrl;
		link.download = file.fileName;
		link.click();
	};

	const zoomOut = () => setZoom((z) => Math.max(0.25, Math.round((z - 0.25) * 100) / 100));
	const zoomIn = () => setZoom((z) => Math.min(4, Math.round((z + 0.25) * 100) / 100));

	if (!open) return null;

	const navButtonSx = {
		position: 'absolute',
		top: '50%',
		transform: 'translateY(-50%)',
		bgcolor: '#fff',
		boxShadow: '0 2px 10px rgba(0,0,0,0.18)',
		color: '#1f2937',
		width: 44,
		height: 44,
		'&:hover': { bgcolor: '#f3f4f6' },
		'&.Mui-disabled': { bgcolor: '#f3f4f6', color: '#cbd5e1', boxShadow: 'none' },
	};

	const renderPreview = () => {
		if (loading) {
			return (
				<Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5, color: '#94a3b8' }}>
					<Spinner size={36} />
					<Typography variant="body2">Loading preview…</Typography>
				</Box>
			);
		}
		if (error) {
			return (
				<Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, color: '#94a3b8', textAlign: 'center', px: 3 }}>
					<InsertDriveFileOutlinedIcon sx={{ fontSize: 54 }} />
					<Typography variant="body2">{error}</Typography>
					<Typography variant="caption">You can still download the file below.</Typography>
				</Box>
			);
		}
		if (isImage && blobUrl) {
			return (
				<Box
					component="img"
					src={blobUrl}
					alt={file.fileName}
					sx={{
						maxWidth: '100%',
						maxHeight: '100%',
						objectFit: 'contain',
						transform: `scale(${zoom})`,
						transition: 'transform 0.15s ease',
						borderRadius: '6px',
					}}
				/>
			);
		}
		if (isPdf && blobUrl) {
			return (
				<Box
					component="iframe"
					src={blobUrl}
					title={file.fileName}
					// Sandbox without allow-scripts: a malicious document cannot run script in
					// the add-in's origin. The browser's native PDF viewer still renders.
					sandbox=""
					referrerPolicy="no-referrer"
					sx={{ width: '100%', height: '100%', border: 'none', borderRadius: '6px', bgcolor: '#fff' }}
				/>
			);
		}
		return (
			<Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, color: '#94a3b8', textAlign: 'center', px: 3 }}>
				<InsertDriveFileOutlinedIcon sx={{ fontSize: 54 }} />
				<Typography variant="body2">No inline preview for {meta?.label} files.</Typography>
				<Typography variant="caption">Use the download button below to open it.</Typography>
			</Box>
		);
	};

	return (
		<Dialog
			open={open}
			onClose={onClose}
			maxWidth="md"
			fullWidth
			PaperProps={{ sx: { borderRadius: '16px', overflow: 'hidden' } }}
		>
			{/* Header */}
			<Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2.5, py: 1.75, borderBottom: '1px solid #eef2f7' }}>
				<Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
					<Typography sx={{ fontWeight: 600, color: '#1f2937', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
						{file.fileName}
					</Typography>
					{meta && (
						<Box sx={{ px: 1, py: '2px', borderRadius: '6px', bgcolor: meta.bg, color: meta.color, fontSize: 11, fontWeight: 700, letterSpacing: '0.03em', flexShrink: 0 }}>
							{meta.label}
						</Box>
					)}
				</Box>
				<IconButton onClick={onClose} size="small" sx={{ color: '#64748b' }}>
					<CloseIcon />
				</IconButton>
			</Box>

			{/* Preview stage */}
			<Box sx={{ position: 'relative', bgcolor: '#f1f5f9', px: { xs: 5, sm: 7 }, py: 3 }}>
				<IconButton onClick={goPrev} disabled={!hasPrev} sx={{ ...navButtonSx, left: 12 }}>
					<ChevronLeftIcon />
				</IconButton>

				<Box
					sx={{
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						height: { xs: 320, sm: 420 },
						overflow: 'hidden',
					}}
				>
					{renderPreview()}
				</Box>

				<IconButton onClick={goNext} disabled={!hasNext} sx={{ ...navButtonSx, right: 12 }}>
					<ChevronRightIcon />
				</IconButton>
			</Box>

			{/* Footer controls */}
			<Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2.5, py: 1.75, gap: 2 }}>
				<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
					<IconButton onClick={zoomOut} disabled={!isImage || zoom <= 0.25} size="small" sx={{ border: '1px solid #e2e8f0', borderRadius: '8px' }}>
						<ZoomOutIcon fontSize="small" />
					</IconButton>
					<IconButton onClick={zoomIn} disabled={!isImage || zoom >= 4} size="small" sx={{ border: '1px solid #e2e8f0', borderRadius: '8px' }}>
						<ZoomInIcon fontSize="small" />
					</IconButton>
					<Typography sx={{ ml: 1, minWidth: 44, textAlign: 'center', fontSize: 13, color: '#475569', fontWeight: 600 }}>
						{Math.round(zoom * 100)}%
					</Typography>
				</Box>

				<Button
					onClick={handleDownload}
					disabled={!blobUrl}
					variant="contained"
					startIcon={<DownloadIcon />}
					sx={{ textTransform: 'none', fontWeight: 600, borderRadius: '10px', px: 2.5 }}
				>
					Download
				</Button>
			</Box>
		</Dialog>
	);
};

export default FilePreview;
