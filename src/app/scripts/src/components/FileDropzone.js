import React, { useRef, useState } from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import CloseIcon from '@mui/icons-material/Close';

const formatBytes = (bytes) => {
    if (bytes === undefined || bytes === null) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Native drag-and-drop file picker (no third-party UI). Emits
// items: { filename, file } so the rest of the upload flow is unchanged.
const FileDropzone = ({ files = [], onChange, multiple = true, accept }) => {
    const inputRef = useRef(null);
    const [dragOver, setDragOver] = useState(false);

    const addFiles = (fileList) => {
        const incoming = Array.from(fileList || []).map((f) => ({ filename: f.name, file: f }));
        if (!incoming.length) return;
        onChange(multiple ? [...files, ...incoming] : [incoming[0]]);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
            addFiles(e.dataTransfer.files);
        }
    };

    const removeAt = (idx) => {
        const next = [...files];
        next.splice(idx, 1);
        onChange(next);
    };

    return (
        <Box sx={{ width: '100%' }}>
            <Box
                role="button"
                tabIndex={0}
                onClick={() => inputRef.current && inputRef.current.click()}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        inputRef.current && inputRef.current.click();
                    }
                }}
                onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                }}
                onDragLeave={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                }}
                onDrop={handleDrop}
                sx={{
                    cursor: 'pointer',
                    border: '2px dashed',
                    borderColor: dragOver ? '#26477C' : '#cbd5e1',
                    borderRadius: '14px',
                    bgcolor: dragOver ? 'rgba(38,71,124,0.05)' : '#f8fafc',
                    px: 3,
                    py: 4,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 1,
                    textAlign: 'center',
                    transition: 'border-color 120ms ease, background-color 120ms ease',
                    outline: 'none',
                    '&:hover': { borderColor: '#94a3b8' },
                }}
            >
                <Box
                    sx={{
                        width: 52,
                        height: 52,
                        borderRadius: '50%',
                        bgcolor: 'rgba(38,71,124,0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mb: 0.5,
                    }}
                >
                    <CloudUploadOutlinedIcon sx={{ fontSize: 28, color: '#26477C' }} />
                </Box>
                <Typography sx={{ fontWeight: 600, color: '#334155' }}>
                    Drag &amp; drop {multiple ? 'your files' : 'your file'} here
                </Typography>
                <Typography variant="body2" sx={{ color: '#94a3b8' }}>
                    or{' '}
                    <Box component="span" sx={{ color: '#26477C', fontWeight: 600, textDecoration: 'underline' }}>
                        browse
                    </Box>{' '}
                    to choose {multiple ? 'files' : 'a file'}
                </Typography>
                <input
                    ref={inputRef}
                    type="file"
                    hidden
                    multiple={multiple}
                    accept={accept}
                    onChange={(e) => {
                        addFiles(e.target.files);
                        e.target.value = '';
                    }}
                />
            </Box>

            {files.length > 0 && (
                <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {files.map((item, idx) => (
                        <Box
                            key={`${item.filename}-${idx}`}
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1.25,
                                border: '1px solid #e8edf3',
                                borderRadius: '10px',
                                px: 1.5,
                                py: 1,
                                bgcolor: '#fff',
                            }}
                        >
                            <InsertDriveFileOutlinedIcon sx={{ color: '#64748b' }} />
                            <Box sx={{ minWidth: 0, flexGrow: 1, textAlign: 'left' }}>
                                <Typography
                                    sx={{
                                        fontSize: 14,
                                        color: '#1f2937',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                    }}
                                >
                                    {item.filename}
                                </Typography>
                                {item.file && (
                                    <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                                        {formatBytes(item.file.size)}
                                    </Typography>
                                )}
                            </Box>
                            <IconButton
                                size="small"
                                aria-label="remove file"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    removeAt(idx);
                                }}
                            >
                                <CloseIcon fontSize="small" />
                            </IconButton>
                        </Box>
                    ))}
                </Box>
            )}
        </Box>
    );
};

export default FileDropzone;
