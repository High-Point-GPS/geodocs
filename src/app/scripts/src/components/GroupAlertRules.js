import React, { useMemo } from 'react';
import {
    Autocomplete,
    Box,
    Button,
    IconButton,
    TextField,
    Tooltip,
    Typography,
    InputAdornment,
} from '@mui/material';

import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import GroupsIcon from '@mui/icons-material/Groups';

import EmailChipsInput, { splitEmails } from './EmailChipsInput';
import { flattenGroups, isCompanyGroupLabel } from '../utils/formatter';

/**
 * Per-group overrides of the global expiry alert settings.
 *
 * Documents store their groups by NAME, and tagging a group stores that group plus every
 * descendant — so a rule keys on the group label and carries the group's `depth` in the
 * tree. The alert job applies the deepest matching rule, which makes a rule on a child
 * group win over one on its parent. Company Group is the root every group hangs off, so
 * it is deliberately not offered here: it is exactly what the global settings above are.
 *
 * A rule leaves a field blank to inherit that half of the global setting — blank emails
 * means "the global address, but on this group's schedule", and vice versa.
 */
const GroupAlertRules = ({ rules, onChange, groupData, globalEmail, globalDays }) => {
    // One row per group, ordered as the tree reads, minus the root.
    const groupOptions = useMemo(
        () => flattenGroups(groupData).filter((g) => !isCompanyGroupLabel(g.label)),
        [groupData]
    );

    const takenGroups = useMemo(
        () => new Set(rules.map((r) => r.group).filter(Boolean)),
        [rules]
    );

    const updateRule = (index, patch) =>
        onChange(rules.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)));

    const removeRule = (index) => onChange(rules.filter((_, i) => i !== index));

    const addRule = () => onChange([...rules, { group: '', groupId: null, depth: 0, emails: '', days: '' }]);

    const globalEmailLabel = splitEmails(globalEmail).join(', ');
    const globalDaysLabel =
        globalDays === 0 || globalDays ? `${globalDays}` : '7';

    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1, mb: 0.75 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 14.5, color: '#334155' }}>
                    Per-Group Alerts
                </Typography>
                <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                    {rules.length ? `${rules.length} override${rules.length === 1 ? '' : 's'}` : 'None'}
                </Typography>
            </Box>
            <Typography variant="caption" sx={{ display: 'block', color: '#64748b', mb: 1.25, lineHeight: 1.5 }}>
                Send a group&rsquo;s expiry alerts to different people, or on a different schedule. Leave a field
                blank to inherit the global setting above
                {globalEmailLabel ? ` (${globalEmailLabel}, ${globalDaysLabel} days)` : ` (${globalDaysLabel} days)`}.
                A document in several groups uses its most specific rule.
            </Typography>

            {rules.length === 0 ? (
                <Box
                    sx={{
                        border: '1px dashed #e2e8f0',
                        borderRadius: '12px',
                        px: 2,
                        py: 1.75,
                        textAlign: 'center',
                        color: '#94a3b8',
                        fontSize: 13,
                    }}
                >
                    Every group currently uses the global settings.
                </Box>
            ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                    {rules.map((rule, index) => (
                        <Box
                            key={index}
                            sx={{
                                border: '1px solid #e5e7eb',
                                borderRadius: '12px',
                                bgcolor: '#fbfcfe',
                                px: 1.5,
                                py: 1.5,
                            }}
                        >
                            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                                {/* Searchable: a real fleet's group tree is far too long to
                                    scroll, and the uploader's group picker already filters. */}
                                <Autocomplete
                                    options={groupOptions}
                                    value={groupOptions.find((g) => g.label === rule.group) || null}
                                    onChange={(_, picked) =>
                                        updateRule(index, {
                                            group: picked ? picked.label : '',
                                            groupId: picked ? String(picked.value) : null,
                                            depth: picked ? picked.depth : 0,
                                        })
                                    }
                                    getOptionLabel={(option) => (option && option.label) || ''}
                                    isOptionEqualToValue={(option, value) => option.label === value.label}
                                    // A group can only carry one rule; its own row stays selectable.
                                    getOptionDisabled={(option) =>
                                        option.label !== rule.group && takenGroups.has(option.label)
                                    }
                                    size="small"
                                    fullWidth
                                    autoHighlight
                                    openOnFocus
                                    noOptionsText="No matching groups"
                                    sx={{ flex: 1, minWidth: 0 }}
                                    renderOption={(props, option) => (
                                        // Indented by depth so the tree's shape survives; the
                                        // key must be unique even when two groups share a name.
                                        <Box
                                            component="li"
                                            {...props}
                                            key={`${option.value}-${option.label}-${option.depth}`}
                                            sx={{ pl: `${16 + option.depth * 14}px !important` }}
                                        >
                                            {option.label}
                                        </Box>
                                    )}
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            label="Group"
                                            placeholder="Search groups…"
                                            sx={{ bgcolor: '#fff', borderRadius: '10px' }}
                                            InputProps={{
                                                ...params.InputProps,
                                                startAdornment: (
                                                    <>
                                                        <InputAdornment position="start" sx={{ ml: 0.5, mr: 0 }}>
                                                            <GroupsIcon sx={{ fontSize: 18, color: '#94a3b8' }} />
                                                        </InputAdornment>
                                                        {params.InputProps.startAdornment}
                                                    </>
                                                ),
                                            }}
                                        />
                                    )}
                                />
                                <TextField
                                    type="number"
                                    size="small"
                                    label="Days before"
                                    value={rule.days}
                                    onChange={(e) => updateRule(index, { days: e.target.value })}
                                    placeholder={globalDaysLabel}
                                    inputProps={{ min: 0, 'aria-label': `Alert days before expiry for ${rule.group || 'group'}` }}
                                    sx={{ width: 140, flexShrink: 0, bgcolor: '#fff', borderRadius: '10px' }}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <EventOutlinedIcon sx={{ fontSize: 18, color: '#94a3b8' }} />
                                            </InputAdornment>
                                        ),
                                    }}
                                />
                                <Tooltip title="Remove this override" arrow>
                                    <IconButton
                                        aria-label={`Remove alert override for ${rule.group || 'group'}`}
                                        onClick={() => removeRule(index)}
                                        sx={{ mt: 0.25, flexShrink: 0, '&:hover': { bgcolor: 'rgba(225, 29, 72, 0.08)' } }}
                                    >
                                        <DeleteOutlineIcon sx={{ color: '#E11D48' }} fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            </Box>
                            <Box sx={{ mt: 1.25 }}>
                                <EmailChipsInput
                                    value={splitEmails(rule.emails)}
                                    onChange={(emails) => updateRule(index, { emails: emails.join(', ') })}
                                    placeholder={
                                        splitEmails(rule.emails).length
                                            ? ''
                                            : globalEmailLabel
                                            ? `Inherits ${globalEmailLabel}`
                                            : 'Add email…'
                                    }
                                    helperText=""
                                    ariaLabel={`Alert emails for ${rule.group || 'group'}`}
                                />
                            </Box>
                        </Box>
                    ))}
                </Box>
            )}

            <Button
                onClick={addRule}
                startIcon={<AddIcon />}
                disabled={groupOptions.length === 0 || rules.length >= groupOptions.length}
                sx={{ textTransform: 'none', fontWeight: 600, mt: 1, color: '#26477C' }}
            >
                Add group override
            </Button>
        </Box>
    );
};

export default GroupAlertRules;
