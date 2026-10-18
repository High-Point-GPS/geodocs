import React, { useEffect, useRef, useState } from 'react';
import { Box, Button, ButtonBase, IconButton, TextField, Tooltip, Typography, InputAdornment } from '@mui/material';

import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
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
 *
 * `inUse` maps a type name to how many documents carry it. It shows a count on each
 * chip (so removing a busy type is a visible decision) and offers the types documents
 * use that are NOT on the list — a driver's "Other", or one removed earlier — as
 * one-click adds. `autoFocus` brings the section into view with the cursor in the add
 * field, for when the dialog was opened from the uploader's "Edit types".
 */
const DocumentTypesInput = ({ value, onChange, inUse = {}, autoFocus = false }) => {
    const [pending, setPending] = useState('');
    const [flash, setFlash] = useState(false);
    const rootRef = useRef(null);
    const inputRef = useRef(null);
    const types = Array.isArray(value) ? value : [];

    useEffect(() => {
        if (!autoFocus) return undefined;
        // After the dialog's enter transition has laid the content out.
        const t = setTimeout(() => {
            if (rootRef.current) rootRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
            if (inputRef.current) inputRef.current.focus({ preventScroll: true });
            setFlash(true);
        }, 250);
        const off = setTimeout(() => setFlash(false), 1800);
        return () => {
            clearTimeout(t);
            clearTimeout(off);
        };
    }, [autoFocus]);

    const lower = (s) => s.trim().toLowerCase();
    const onList = (name) => types.some((t) => lower(t) === lower(name));
    const countFor = (name) =>
        Object.entries(inUse).reduce((sum, [k, n]) => (lower(k) === lower(name) ? sum + n : sum), 0);

    // Same rule the backend enforces, applied here so the user sees why nothing happened.
    const duplicate = !!pending.trim() && onList(pending);
    const tooLong = pending.trim().length > MAX_LENGTH;
    const full = types.length >= MAX_TYPES;
    const canAdd = !!pending.trim() && !duplicate && !tooLong && !full;

    const add = (name) => {
        const clean = String(name).trim();
        if (!clean || onList(clean) || types.length >= MAX_TYPES) return;
        onChange([...types, clean]);
    };

    const addPending = () => {
        if (!canAdd) return;
        add(pending);
        setPending('');
    };

    const removeAt = (index) => onChange(types.filter((_, i) => i !== index));

    // Types documents carry that the list does not, busiest first. Case-folded so
    // "fuel receipt" and "Fuel Receipt" are one suggestion.
    const suggestions = Object.values(
        Object.entries(inUse).reduce((acc, [name, n]) => {
            if (onList(name)) return acc;
            const key = lower(name);
            acc[key] = acc[key] ? { name: acc[key].name, n: acc[key].n + n } : { name, n };
            return acc;
        }, {})
    ).sort((a, b) => b.n - a.n);

    const helperText = duplicate
        ? 'That type is already on the list.'
        : tooLong
        ? `Keep it under ${MAX_LENGTH} characters.`
        : full
        ? `That's the maximum of ${MAX_TYPES} types.`
        : 'Press Enter to add. Drivers pick from this list when they upload.';

    return (
        <Box
            ref={rootRef}
            sx={{
                borderRadius: '12px',
                mx: -1,
                px: 1,
                py: 0.5,
                transition: 'background-color 600ms',
                bgcolor: flash ? '#fff7ed' : 'transparent',
            }}
        >
            <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1, mb: 0.75 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 14.5, color: '#334155' }}>
                    Document Types
                </Typography>
                <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                    {types.length ? `${types.length} type${types.length === 1 ? '' : 's'}` : 'None'}
                </Typography>
            </Box>
            <Typography variant="caption" sx={{ display: 'block', color: '#64748b', mb: 1.25, lineHeight: 1.5 }}>
                What a document can be, in your own words. Drivers can also type their own with
                &ldquo;Other&rdquo; when nothing fits.
            </Typography>

            {types.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1.25 }}>
                    {types.map((type, index) => {
                        const n = countFor(type);
                        return (
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
                                {n > 0 && (
                                    <Box component="span" sx={{ fontWeight: 500, color: '#6366f1', fontSize: 12 }}>
                                        · {n}
                                    </Box>
                                )}
                                <Tooltip
                                    title={
                                        n
                                            ? `Remove from the list. The ${n} document${n === 1 ? '' : 's'} using it keep${n === 1 ? 's' : ''} the type.`
                                            : 'Remove'
                                    }
                                    arrow
                                >
                                    <IconButton
                                        size="small"
                                        aria-label={`Remove document type ${type}`}
                                        onClick={() => removeAt(index)}
                                        sx={{ p: 0.25, color: '#6366f1', '&:hover': { color: '#E11D48' } }}
                                    >
                                        <CloseIcon sx={{ fontSize: 15 }} />
                                    </IconButton>
                                </Tooltip>
                            </Box>
                        );
                    })}
                </Box>
            )}

            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                <TextField
                    size="small"
                    fullWidth
                    inputRef={inputRef}
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

            {suggestions.length > 0 && !full && (
                <Box sx={{ mt: 1.25 }}>
                    <Typography variant="caption" sx={{ display: 'block', color: '#64748b', mb: 0.75 }}>
                        Used on documents but not on your list — click to add:
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                        {suggestions.slice(0, 12).map((s) => (
                            <ButtonBase
                                key={s.name}
                                onClick={() => add(s.name)}
                                focusRipple
                                sx={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 0.5,
                                    px: 1,
                                    py: 0.4,
                                    borderRadius: '8px',
                                    border: '1px dashed #cbd5e1',
                                    color: '#334155',
                                    fontSize: 13,
                                    fontWeight: 500,
                                    fontFamily: 'inherit',
                                    '&:hover': { borderColor: '#26477C', bgcolor: '#f8fafc' },
                                }}
                            >
                                <AddIcon sx={{ fontSize: 15, color: '#26477C' }} />
                                {s.name}
                                <Box component="span" sx={{ color: '#94a3b8', fontSize: 12 }}>
                                    · {s.n}
                                </Box>
                            </ButtonBase>
                        ))}
                    </Box>
                </Box>
            )}
        </Box>
    );
};

export default DocumentTypesInput;
