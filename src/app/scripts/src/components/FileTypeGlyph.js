import React from 'react';
import { Box } from '@mui/material';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import GridOnOutlinedIcon from '@mui/icons-material/GridOnOutlined';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';

import { getFileTypeMeta } from '../utils/formatter';

const iconForKind = (kind, color, size) => {
    const sx = { fontSize: size, color };
    switch (kind) {
        case 'image':
            return <ImageOutlinedIcon sx={sx} />;
        case 'pdf':
            return <PictureAsPdfOutlinedIcon sx={sx} />;
        case 'doc':
            return <DescriptionOutlinedIcon sx={sx} />;
        case 'sheet':
            return <GridOnOutlinedIcon sx={sx} />;
        default:
            return <InsertDriveFileOutlinedIcon sx={sx} />;
    }
};

// Rounded, color-coded glyph for a file based on its extension.
const FileTypeGlyph = ({ fileName = '', size = 40, iconSize = 22, radius = 10 }) => {
    const meta = getFileTypeMeta(fileName);
    return (
        <Box
            sx={{
                width: size,
                height: size,
                borderRadius: `${radius}px`,
                bgcolor: meta.bg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
            }}
        >
            {iconForKind(meta.kind, meta.color, iconSize)}
        </Box>
    );
};

export default FileTypeGlyph;
