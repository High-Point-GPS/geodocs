import React, { useEffect, useMemo, useState } from 'react';
import { Box, Button, IconButton, InputAdornment, TextField, Tooltip, Typography } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import LabelOutlinedIcon from '@mui/icons-material/LabelOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import DirectionsCarOutlinedIcon from '@mui/icons-material/DirectionsCarOutlined';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import PhoneIphoneOutlinedIcon from '@mui/icons-material/PhoneIphoneOutlined';
import MobileOffOutlinedIcon from '@mui/icons-material/MobileOffOutlined';
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';
import FlatbedTrailerIcon from './FlatbedTrailerIcon';
import FileTypeGlyph from './FileTypeGlyph';
import { generateCSV } from '../utils/csv-generator';
import { collapseCompanyGroup, ownerDisplay, resolveOwner } from '../utils/formatter';
import { daysUntil, expiryState } from '../utils/tabel-helper';
import { CSVLink } from 'react-csv';
import dayjs from 'dayjs';

const EXPIRY_TONE = {
    expired: { fg: '#B91C1C', bg: '#FDECEA' },
    soon: { fg: '#C2630B', bg: '#FEF3E2' },
};

const ASSOCIATION = {
    vehicles: { icon: DirectionsCarOutlinedIcon, bg: '#fff7e0' },
    drivers: { icon: PersonOutlinedIcon, bg: '#e3f2fd' },
    trailers: { icon: FlatbedTrailerIcon, bg: '#f3e5f5' },
    groups: { icon: GroupsOutlinedIcon, bg: '#eef2f6' },
};

/**
 * The document list for narrow widths, as cards: what each document is, when it
 * expires, what it is attached to, and its actions — everything the table row shows,
 * without expanding anything. Matches the GeoDocs Drive cards.
 */
const DocumentMobile = ({ files, geotabAssets, onOrderedFilesChange }) => {
    const [query, setQuery] = useState('');

    const cards = useMemo(() => {
        const q = query.trim().toLowerCase();
        return files
            .map((file) => {
                // The narrow list consumes the raw file list, so guard owners here.
                const owners = file.owners || {};
                const ownerNames = file.ownerNames || {};
                const named = (key) =>
                    (Array.isArray(owners[key]) ? owners[key] : []).map((id, i) => {
                        const resolved = resolveOwner(
                            id,
                            Array.isArray(ownerNames[key]) ? ownerNames[key][i] : undefined,
                            geotabAssets,
                            key
                        );
                        return { kind: key, label: ownerDisplay(resolved, key), archived: resolved.archived };
                    });
                const associations = [
                    ...named('vehicles'),
                    ...named('drivers'),
                    ...named('trailers'),
                    ...collapseCompanyGroup(Array.isArray(owners.groups) ? owners.groups : []).map((g) => ({
                        kind: 'groups',
                        label: g,
                    })),
                ];
                return { file, associations };
            })
            .filter(({ file, associations }) => {
                if (!q) return true;
                const by = file.uploadedBy || {};
                return [file.fileName, file.documentType, file.description, by.driverName, by.userName, ...associations.map((a) => a.label)]
                    .filter(Boolean)
                    .some((v) => String(v).toLowerCase().includes(q));
            });
    }, [files, geotabAssets, query]);

    // Report the visible order so the shared preview's prev/next matches this list.
    const ordered = useMemo(() => cards.map((c) => c.file), [cards]);
    useEffect(() => {
        if (onOrderedFilesChange) onOrderedFilesChange(ordered);
    }, [ordered, onOrderedFilesChange]);

    return (
        <Box sx={{ px: { xs: 1, sm: 2 }, pb: 4, mt: 1 }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1.5 }}>
                <TextField
                    size="small"
                    fullWidth
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search files, vehicles, drivers, types…"
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon sx={{ fontSize: 18, color: '#94a3b8' }} />
                            </InputAdornment>
                        ),
                        endAdornment: query ? (
                            <InputAdornment position="end">
                                <IconButton size="small" aria-label="Clear search" onClick={() => setQuery('')}>
                                    <CloseIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                            </InputAdornment>
                        ) : null,
                        sx: { borderRadius: '10px', bgcolor: '#fff' },
                    }}
                />
                <CSVLink data={generateCSV(files)} filename={'geodoc.csv'} style={{ textDecoration: 'none', flexShrink: 0 }}>
                    <Button
                        component="span"
                        variant="outlined"
                        startIcon={<DownloadIcon />}
                        sx={{
                            textTransform: 'none',
                            fontWeight: 600,
                            borderRadius: '10px',
                            borderColor: '#e5e7eb',
                            color: '#334155',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        CSV
                    </Button>
                </CSVLink>
            </Box>

            <Typography sx={{ fontSize: 13, color: '#64748b', mb: 1 }}>
                {cards.length} of {files.length} document{files.length === 1 ? '' : 's'}
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                {cards.length === 0 ? (
                    <Box sx={{ textAlign: 'center', py: 6, color: '#64748b' }}>
                        <FolderOpenOutlinedIcon sx={{ fontSize: 44, color: '#cbd5e1' }} />
                        <Typography sx={{ fontWeight: 600, color: '#334155', mt: 1 }}>
                            {query ? 'No matching documents' : 'No documents yet'}
                        </Typography>
                    </Box>
                ) : (
                    cards.map(({ file, associations }) => {
                        const state = expiryState(file.expiryDate);
                        const days = file.expiryDate ? daysUntil(file.expiryDate) : null;
                        const tone = EXPIRY_TONE[state];
                        const by = file.uploadedBy;
                        return (
                            <Box
                                key={file.id}
                                sx={{
                                    bgcolor: '#fff',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '14px',
                                    boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
                                    overflow: 'hidden',
                                }}
                            >
                                <Box sx={{ display: 'flex', gap: 1.5, p: 1.5, pb: 1 }}>
                                    <FileTypeGlyph fileName={file.fileName} size={42} iconSize={22} radius={10} />
                                    <Box sx={{ minWidth: 0, flex: 1 }}>
                                        <Typography
                                            sx={{ fontWeight: 600, fontSize: 15, color: '#0f172a', lineHeight: 1.3, wordBreak: 'break-word' }}
                                        >
                                            {file.fileName}
                                        </Typography>
                                        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.75, mt: 0.5 }}>
                                            {file.documentType && (
                                                <Box
                                                    sx={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: 0.4,
                                                        px: 0.8,
                                                        py: '1px',
                                                        borderRadius: '6px',
                                                        bgcolor: '#eef2ff',
                                                        color: '#3730a3',
                                                        fontSize: 11.5,
                                                        fontWeight: 700,
                                                    }}
                                                >
                                                    <LabelOutlinedIcon sx={{ fontSize: 12 }} />
                                                    {file.documentType}
                                                </Box>
                                            )}
                                            <Typography sx={{ fontSize: 12.5, color: '#64748b' }}>
                                                {file.expiryDate ? `Expires ${dayjs(file.expiryDate).format('MMM D, YYYY')}` : 'No expiry'}
                                            </Typography>
                                            {tone && (
                                                <Box
                                                    sx={{
                                                        px: 0.9,
                                                        py: '1px',
                                                        borderRadius: '999px',
                                                        bgcolor: tone.bg,
                                                        color: tone.fg,
                                                        fontSize: 11.5,
                                                        fontWeight: 700,
                                                    }}
                                                >
                                                    {state === 'expired'
                                                        ? 'Expired'
                                                        : days === 0
                                                            ? 'Expires today'
                                                            : `${days} day${days === 1 ? '' : 's'} left`}
                                                </Box>
                                            )}
                                            <Tooltip
                                                title={file.hideFromDriver ? 'Hidden from drivers in the Drive app' : 'Drivers can see this in the Drive app'}
                                                arrow
                                            >
                                                {file.hideFromDriver ? (
                                                    <MobileOffOutlinedIcon sx={{ fontSize: 15, color: '#DC2626' }} />
                                                ) : (
                                                    <PhoneIphoneOutlinedIcon sx={{ fontSize: 15, color: '#1B7A3D' }} />
                                                )}
                                            </Tooltip>
                                        </Box>
                                        {by && (
                                            <Typography sx={{ fontSize: 12, color: '#64748b', mt: 0.4 }}>
                                                Added from the Drive app by {by.driverName || by.userName || 'a driver'}
                                            </Typography>
                                        )}
                                    </Box>
                                </Box>

                                {associations.length > 0 && (
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6, px: 1.5, pb: 1.25 }}>
                                        {associations.map((a, i) => {
                                            const Icon = ASSOCIATION[a.kind].icon;
                                            return (
                                                <Box
                                                    key={`${a.kind}-${a.label}-${i}`}
                                                    sx={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: 0.5,
                                                        px: 1,
                                                        py: 0.3,
                                                        borderRadius: '999px',
                                                        bgcolor: ASSOCIATION[a.kind].bg,
                                                        color: a.archived ? '#94a3b8' : '#334155',
                                                        fontStyle: a.archived ? 'italic' : 'normal',
                                                        fontSize: 12.5,
                                                    }}
                                                >
                                                    <Icon sx={{ fontSize: 14, color: '#64748b' }} />
                                                    {a.label}
                                                </Box>
                                            );
                                        })}
                                    </Box>
                                )}

                                <Box
                                    sx={{
                                        display: 'flex',
                                        justifyContent: 'flex-end',
                                        alignItems: 'center',
                                        gap: 0.5,
                                        borderTop: '1px solid #f1f5f9',
                                        px: 1,
                                        py: 0.25,
                                    }}
                                >
                                    {file.action}
                                </Box>
                            </Box>
                        );
                    })
                )}
            </Box>
        </Box>
    );
};

export default DocumentMobile;
