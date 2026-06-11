import React from 'react';
import { Autocomplete, Chip, TextField } from '@mui/material';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The backend stores alert emails as a single comma-separated string; this turns
// that (or pasted "a@x.com, b@y.com; c@z.com" text) into a clean list.
export const splitEmails = (value) =>
    String(value || '')
        .split(/[,;\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);

// Multi-email input rendered as chips. Typing Enter (or blurring) commits the
// pending text; pasted comma/semicolon lists are split; invalid addresses and
// duplicates are dropped silently.
const EmailChipsInput = ({ value, onChange, label, placeholder, helperText, sx, disabled, startIcon, ariaLabel }) => {
    const commit = (list) => {
        // Entries already present came from storage; keep them even if they wouldn't
        // pass validation today, so editing other chips can't silently drop them.
        const existing = new Set((value || []).map((v) => String(v).toLowerCase()));
        const cleaned = [];
        list.flatMap(splitEmails).forEach((email) => {
            const normalized = email.toLowerCase();
            if (
                (EMAIL_RE.test(normalized) || existing.has(normalized)) &&
                !cleaned.includes(normalized)
            ) {
                cleaned.push(normalized);
            }
        });
        onChange(cleaned);
    };

    return (
        <Autocomplete
            multiple
            freeSolo
            autoSelect
            options={[]}
            value={value}
            onChange={(e, newValue) => commit(newValue)}
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
                    helperText={helperText}
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
