import React, { useEffect, useRef, useState } from 'react';
import {
    Autocomplete,
    Box,
    Button,
    ButtonBase,
    CircularProgress,
    InputAdornment,
    InputBase,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';

import AddIcon from '@mui/icons-material/Add';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import LabelOutlinedIcon from '@mui/icons-material/LabelOutlined';
import TuneIcon from '@mui/icons-material/Tune';

const NAVY = '#26477C';
const MAX_LENGTH = 60;
// Past this many types a row of chips stops being quicker than a searchable menu.
const MAX_CHIPS = 12;

// One pill. `tone` says how it relates to the fleet's list.
const TypeChip = ({ label, selected, onClick, tone = 'list', title, icon, disabled }) => {
    const chip = (
        <ButtonBase
            onClick={onClick}
            disabled={disabled}
            focusRipple
            role="radio"
            aria-checked={!!selected}
            sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                height: 32,
                px: 1.5,
                borderRadius: '16px',
                fontSize: 13.5,
                fontWeight: selected ? 700 : 500,
                fontFamily: 'inherit',
                border: '1px solid',
                borderStyle: tone === 'list' ? 'solid' : 'dashed',
                borderColor: selected ? NAVY : tone === 'add' ? '#cbd5e1' : '#e2e8f0',
                bgcolor: selected ? NAVY : '#fff',
                color: selected ? '#fff' : tone === 'add' ? '#475569' : '#1f2937',
                transition: 'background-color 120ms, border-color 120ms',
                '&:hover': selected ? { bgcolor: '#1f3b66' } : { borderColor: '#94a3b8', bgcolor: '#f8fafc' },
                '&.Mui-focusVisible': { outline: `2px solid ${NAVY}`, outlineOffset: 2 },
            }}
        >
            {selected ? <CheckIcon sx={{ fontSize: 16, ml: -0.25 }} /> : icon}
            {label}
        </ButtonBase>
    );
    return title ? (
        <Tooltip title={title} arrow>
            <span>{chip}</span>
        </Tooltip>
    ) : (
        chip
    );
};

/**
 * What a document is, picked from the fleet's own list (Fleet Settings). A short list is
 * laid out as one-click chips; a long one becomes a searchable menu. New types can be
 * added inline — written to the fleet straight away, so what gets saved on the document
 * is a type that exists — and "Edit types" opens Fleet Settings for renaming/removing.
 *
 * A type stored on this document that is not on the list (removed since, or typed by a
 * driver in the Drive app) still shows, dashed, so saving can never silently drop it.
 */
const DocumentTypePicker = ({ value, onChange, types = [], onAddType, onEditTypes, disabled }) => {
    const [adding, setAdding] = useState(false);
    const [draft, setDraft] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const inputRef = useRef(null);

    useEffect(() => {
        if (adding && inputRef.current) inputRef.current.focus();
    }, [adding]);

    const offList = value && !types.some((t) => t.toLowerCase() === value.toLowerCase());
    const trimmed = draft.trim();
    const existing = types.find((t) => t.toLowerCase() === trimmed.toLowerCase());

    const addType = async (name) => {
        const clean = String(name || '').trim();
        if (!clean) return;
        const match = types.find((t) => t.toLowerCase() === clean.toLowerCase());
        if (match) {
            // Already on the list: just pick it.
            onChange(match);
            setAdding(false);
            setDraft('');
            return;
        }
        setSaving(true);
        setError('');
        try {
            await onAddType(clean);
            onChange(clean);
            setAdding(false);
            setDraft('');
        } catch (err) {
            setError(err.message || 'Could not add that type.');
        } finally {
            setSaving(false);
        }
    };

    const header = (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 0.75 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 13.5, color: '#334155' }}>
                Document type
                <Typography component="span" sx={{ fontWeight: 400, fontSize: 12.5, color: '#94a3b8', ml: 0.75 }}>
                    optional
                </Typography>
            </Typography>
            {onEditTypes && (
                <Button
                    size="small"
                    onClick={onEditTypes}
                    startIcon={<TuneIcon sx={{ fontSize: '16px !important' }} />}
                    sx={{ textTransform: 'none', fontWeight: 600, color: NAVY, py: 0.25, px: 1, minWidth: 0 }}
                >
                    Edit types
                </Button>
            )}
        </Box>
    );

    const addControl = onAddType ? (
        adding ? (
            <Box
                sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    height: 32,
                    pl: 1.25,
                    pr: 0.25,
                    borderRadius: '16px',
                    border: `1px solid ${error ? '#E11D48' : NAVY}`,
                    bgcolor: '#fff',
                    boxShadow: '0 0 0 3px rgba(38,71,124,0.12)',
                }}
            >
                <InputBase
                    inputRef={inputRef}
                    value={draft}
                    onChange={(e) => {
                        setDraft(e.target.value);
                        setError('');
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            addType(draft);
                        } else if (e.key === 'Escape') {
                            e.stopPropagation();
                            setAdding(false);
                            setDraft('');
                            setError('');
                        }
                    }}
                    placeholder="New type"
                    disabled={saving}
                    inputProps={{ maxLength: MAX_LENGTH, 'aria-label': 'New document type' }}
                    sx={{ fontSize: 13.5, width: Math.max(96, Math.min(220, draft.length * 8 + 40)) }}
                />
                {saving ? (
                    <CircularProgress size={16} sx={{ mx: 0.75 }} />
                ) : (
                    <>
                        <Tooltip title={existing ? `Use “${existing}”` : 'Add to your list'} arrow>
                            <span>
                                <ButtonBase
                                    onClick={() => addType(draft)}
                                    disabled={!trimmed}
                                    aria-label="Add type"
                                    sx={{ borderRadius: '50%', p: 0.5, color: trimmed ? NAVY : '#cbd5e1' }}
                                >
                                    <CheckIcon sx={{ fontSize: 18 }} />
                                </ButtonBase>
                            </span>
                        </Tooltip>
                        <ButtonBase
                            onClick={() => {
                                setAdding(false);
                                setDraft('');
                                setError('');
                            }}
                            aria-label="Cancel new type"
                            sx={{ borderRadius: '50%', p: 0.5, color: '#94a3b8' }}
                        >
                            <CloseIcon sx={{ fontSize: 16 }} />
                        </ButtonBase>
                    </>
                )}
            </Box>
        ) : (
            <TypeChip
                label="New type"
                tone="add"
                icon={<AddIcon sx={{ fontSize: 16, ml: -0.25 }} />}
                onClick={() => setAdding(true)}
                disabled={disabled}
            />
        )
    ) : null;

    const footnote = error ? (
        <Typography sx={{ color: '#E11D48', fontSize: 12.5, mt: 0.75 }}>{error}</Typography>
    ) : existing && adding && trimmed ? (
        <Typography sx={{ color: '#64748b', fontSize: 12.5, mt: 0.75 }}>
            Already on your list — this will select “{existing}”.
        </Typography>
    ) : types.length === 0 && !value ? (
        <Typography sx={{ color: '#94a3b8', fontSize: 12.5, mt: 0.75 }}>
            No types yet. Add the kinds of documents your fleet keeps, like “Registration” or “Insurance”.
        </Typography>
    ) : null;

    // Long list: a searchable menu, with the add row and the edit link kept alongside.
    if (types.length > MAX_CHIPS) {
        const options = offList ? [value, ...types] : types;
        return (
            <Box>
                {header}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Autocomplete
                        size="small"
                        options={options}
                        value={value || null}
                        onChange={(e, picked) => onChange(picked || '')}
                        disabled={disabled}
                        sx={{ flex: '1 1 260px', minWidth: 220 }}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                placeholder={`Search ${types.length} types…`}
                                InputProps={{
                                    ...params.InputProps,
                                    startAdornment: (
                                        <>
                                            <InputAdornment position="start" sx={{ ml: 0.5, mr: 0 }}>
                                                <LabelOutlinedIcon sx={{ fontSize: 18, color: '#94a3b8' }} />
                                            </InputAdornment>
                                            {params.InputProps.startAdornment}
                                        </>
                                    ),
                                }}
                            />
                        )}
                    />
                    {addControl}
                </Box>
                {footnote}
            </Box>
        );
    }

    return (
        <Box>
            {header}
            <Box role="radiogroup" aria-label="Document type" sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {offList && (
                    <TypeChip
                        label={value}
                        selected
                        tone="off"
                        onClick={() => onChange('')}
                        title="Not on your list of types (typed by a driver, or removed since). Kept as it is unless you pick another."
                        disabled={disabled}
                    />
                )}
                {offList && onAddType && (
                    <Button
                        size="small"
                        onClick={() => addType(value)}
                        disabled={disabled || saving}
                        startIcon={saving ? <CircularProgress size={12} /> : <AddIcon sx={{ fontSize: '15px !important' }} />}
                        sx={{ textTransform: 'none', fontWeight: 600, color: NAVY, height: 32, px: 1, minWidth: 0 }}
                    >
                        Add “{value}” to list
                    </Button>
                )}
                {types.map((type) => {
                    const selected = !!value && value.toLowerCase() === type.toLowerCase();
                    return (
                        <TypeChip
                            key={type}
                            label={type}
                            selected={selected}
                            // Clicking the chosen one again clears it — the field is optional.
                            onClick={() => onChange(selected ? '' : type)}
                            disabled={disabled}
                        />
                    );
                })}
                {addControl}
            </Box>
            {footnote}
        </Box>
    );
};

export default DocumentTypePicker;
