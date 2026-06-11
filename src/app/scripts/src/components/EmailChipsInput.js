import React, { useState } from 'react';
import { Autocomplete, Chip, TextField } from '@mui/material';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The backend stores alert emails as a single comma-separated string; this turns
// that (or pasted "a@x.com, b@y.com; c@z.com" text) into a clean list.
export const splitEmails = (value) =>
    String(value || '')
        .split(/[,;\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);

// Multi-email input rendered as chips. A complete address becomes a chip as soon as
// Space/comma/semicolon/Enter is typed (or on blur); pasted lists are split; invalid
// addresses, duplicates, and anything in `rejectEmails` are dropped silently.
const EmailChipsInput = ({
    value,
    onChange,
    label,
    placeholder,
    helperText,
    sx,
    disabled,
    startIcon,
    ariaLabel,
    rejectEmails,
    rejectMessage,
}) => {
    const [pending, setPending] = useState('');
    // Addresses dropped by rejectEmails on the last commit; shown as an inline notice
    // so the rejection isn't silent. Cleared as soon as the user types again.
    const [rejectedNotice, setRejectedNotice] = useState(null);

    const commit = (list) => {
        // Entries already present came from storage; keep them even if they wouldn't
        // pass validation today, so editing other chips can't silently drop them.
        // rejectEmails wins over that: those addresses are removed unconditionally.
        const existing = new Set((value || []).map((v) => String(v).toLowerCase()));
        const rejected = new Set((rejectEmails || []).map((e) => String(e).trim().toLowerCase()));
        const cleaned = [];
        const dropped = [];
        list.flatMap(splitEmails).forEach((email) => {
            const normalized = email.toLowerCase();
            if (rejected.has(normalized)) {
                if (!dropped.includes(normalized)) dropped.push(normalized);
                return;
            }
            if (
                (EMAIL_RE.test(normalized) || existing.has(normalized)) &&
                !cleaned.includes(normalized)
            ) {
                cleaned.push(normalized);
            }
        });
        setRejectedNotice(dropped.length ? dropped : null);
        onChange(cleaned);
    };

    // Space/comma/semicolon after a complete address turns it into a chip right away
    // (these characters can't appear inside an email, so this never fires mid-address).
    // After an incomplete address the delimiter is swallowed and typing continues.
    const handleInputChange = (event, newInput, reason) => {
        if (/[,;\s]$/.test(newInput)) {
            const candidate = newInput.trim();
            if (candidate && EMAIL_RE.test(candidate.toLowerCase())) {
                commit([...(value || []), candidate]);
                setPending('');
            } else {
                setPending(candidate);
            }
            return;
        }
        setPending(newInput);
        // Only real typing dismisses the notice — MUI's programmatic 'reset' right
        // after a commit must not wipe it before the user has seen it.
        if (rejectedNotice && reason === 'input' && newInput) {
            setRejectedNotice(null);
        }
    };

    const noticeText = rejectedNotice
        ? rejectMessage
            ? rejectMessage(rejectedNotice)
            : `${rejectedNotice.join(', ')} can't be added here.`
        : null;

    return (
        <Autocomplete
            multiple
            freeSolo
            autoSelect
            options={[]}
            value={value}
            onChange={(e, newValue) => commit(newValue)}
            inputValue={pending}
            onInputChange={handleInputChange}
            disabled={disabled}
            size="small"
            sx={sx}
            renderTags={(tags, getTagProps) =>
                tags.map((option, index) => (
                    <Chip
                        size="small"
                        label={option}
                        {...getTagProps({ index })}
                        key={option}
                        sx={{
                            bgcolor: '#eef2ff',
                            color: '#26477C',
                            fontWeight: 600,
                            borderRadius: '8px',
                            '& .MuiChip-deleteIcon': {
                                color: '#26477C',
                                '&:hover': { color: '#1e3a5f' },
                            },
                        }}
                    />
                ))
            }
            renderInput={(params) => (
                <TextField
                    {...params}
                    label={label}
                    placeholder={placeholder}
                    helperText={noticeText || helperText}
                    FormHelperTextProps={
                        noticeText ? { sx: { color: '#B45309', fontWeight: 600 } } : undefined
                    }
                    inputProps={
                        ariaLabel
                            ? { ...params.inputProps, 'aria-label': ariaLabel }
                            : params.inputProps
                    }
                    InputProps={
                        startIcon
                            ? {
                                  ...params.InputProps,
                                  startAdornment: (
                                      <>
                                          {startIcon}
                                          {params.InputProps.startAdornment}
                                      </>
                                  ),
                              }
                            : params.InputProps
                    }
                />
            )}
        />
    );
};

export default EmailChipsInput;
