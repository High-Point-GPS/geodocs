import React, { useState } from 'react';
import { Box, Button, IconButton, TextField, Tooltip, Typography, InputAdornment } from '@mui/material';

import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import LabelOutlinedIcon from '@mui/icons-material/LabelOutlined';

const MAX_TYPES = 50;
const MAX_LENGTH = 60;

/**
 * The fleet's own vocabulary for what a document is — "Bill of Lading", "Fuel Receipt",
 * "Damage Photo". Drivers pick from this list when they upload from the Drive app, and
 * it's what the Type column on the document table shows.
 *
 * Kept as a plain ordered list of strings (matching how the backend stores it) rather
 * than ids: documents record the type by name, so a name is the identity.
 */
const DocumentTypesInput = ({ value, onChange }) => {
    const [pending, setPending] = useState('');
    const types = Array.isArray(value) ? value : [];

    // Same rule the backend enforces, applied here so the user sees why nothing happened.
    const duplicate = types.some((t) => t.trim().toLowerCase() === pending.trim().toLowerCase());
    const tooLong = pending.trim().length > MAX_LENGTH;
    const full = types.length >= MAX_TYPES;
    const canAdd = !!pending.trim() && !duplicate && !tooLong && !full;

    const addPending = () => {
        if (!canAdd) return;
        onChange([...types, pending.trim()]);
        setPending('');
    };

    const removeAt = (index) => onChange(types.filter((_, i) => i !== index));

    const helperText = duplicate
        ? 'That type is already on the list.'
        : tooLong
        ? `Keep it under ${MAX_LENGTH} characters.`
        : full
        ? `That's the maximum of ${MAX_TYPES} types.`
        : 'Press Enter to add. Drivers pick from this list when they upload.';

    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1, mb: 0.75 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 14.5, color: '#334155' }}>
                    Document Types
                </Typography>
                <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                    {types.length ? `${types.length} type${types.length === 1 ? '' : 's'}` : 'None'}
                </Typography>
            </Box>
            <Typography variant="caption" sx={{ display: 'block', color: '#64748b', mb: 1.25, lineHeight: 1.5 }}>
                What a document can be, in your own words. With no types listed, drivers upload without
                choosing one.
            </Typography>

            {types.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1.25 }}>
                    {types.map((type, index) => (
                        <Box
                            key={`${type}-${index}`}
                            sx={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 0.5,
                                pl: 1,
                                pr: 0.25,
                                py: 0.25,
                                borderRadius: '8px',
                                border: '1px solid #e0e7ff',
                                bgcolor: '#eef2ff',
                                color: '#3730a3',
                                fontSize: 13,
                                fontWeight: 600,
                            }}
                        >
                            <LabelOutlinedIcon sx={{ fontSize: 15 }} />
                            {type}
                            <Tooltip title="Remove" arrow>
                                <IconButton
                                    size="small"
                                    aria-label={`Remove document type ${type}`}
                                    onClick={() => removeAt(index)}
                                    sx={{ p: 0.25, color: '#6366f1', '&:hover': { color: '#E11D48' } }}
                                >
                                    <DeleteOutlineIcon sx={{ fontSize: 15 }} />
                                </IconButton>
                            </Tooltip>
                        </Box>
                    ))}
                </Box>
            )}

            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                <TextField
                    size="small"
                    fullWidth
                    value={pending}
                    onChange={(e) => setPending(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            addPending();
                        }
                    }}
                    onBlur={addPending}
                    disabled={full}
                    placeholder={full ? '' : 'e.g. Registration'}
                    inputProps={{ 'aria-label': 'New document type', maxLength: MAX_LENGTH + 1 }}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <LabelOutlinedIcon sx={{ fontSize: 18, color: '#94a3b8' }} />
                            </InputAdornment>
                        ),
                    }}
                    error={duplicate || tooLong}
                    helperText={helperText}
                />
                <Button
                    onClick={addPending}
                    disabled={!canAdd}
                    startIcon={<AddIcon />}
                    sx={{ textTransform: 'none', fontWeight: 600, mt: 0.5, flexShrink: 0, color: '#26477C' }}
                >
                    Add
                </Button>
            </Box>
        </Box>
    );
};

export default DocumentTypesInput;
