import React, { useEffect, useMemo, useState } from 'react';
import {
    Autocomplete,
    Badge,
    Box,
    Button,
    Dialog,
    DialogContent,
    DialogTitle,
    IconButton,
    TextField,
    Typography,
} from '@mui/material';
import dayjs from 'dayjs';

import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar';
import { PickersDay } from '@mui/x-date-pickers/PickersDay';

import CloseIcon from '@mui/icons-material/Close';
import DirectionsCarOutlinedIcon from '@mui/icons-material/DirectionsCarOutlined';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import EventBusyOutlinedIcon from '@mui/icons-material/EventBusyOutlined';

import FileTypeGlyph from './FileTypeGlyph';
import FlatbedTrailerIcon from './FlatbedTrailerIcon';

// Same icons the document table uses for these owner kinds.
const KIND_META = {
    vehicles: { group: 'Vehicles', Icon: DirectionsCarOutlinedIcon },
    drivers: { group: 'Drivers', Icon: PersonOutlinedIcon },
    trailers: { group: 'Trailers', Icon: FlatbedTrailerIcon },
};

// Same status tones used by the table's Expired/Active pills.
const TONES = {
    expired: { bg: '#FEF3E2', color: '#C2630B' },
    active: { bg: '#E7F6EC', color: '#1B7A3D' },
};

const StatusPill = ({ expired }) => {
    const t = expired ? TONES.expired : TONES.active;
    return (
        <Box
            sx={{
                px: 1,
                py: '2px',
                borderRadius: '999px',
                bgcolor: t.bg,
                color: t.color,
                fontSize: 11.5,
                fontWeight: 700,
                lineHeight: 1.6,
                whiteSpace: 'nowrap',
                flexShrink: 0,
            }}
        >
            {expired ? 'Expired' : 'Active'}
        </Box>
    );
};

// Calendar day with a circled document count. Dates on or before today carry the
// expired tone (a document expiring today already shows as Expired in the table).
const DayWithBadge = (props) => {
    const { day, outsideCurrentMonth, filesByDay, ...other } = props;
    const count = outsideCurrentMonth ? 0 : (filesByDay.get(day.format('YYYY-MM-DD')) || []).length;
    const tone = day.isAfter(dayjs(), 'day') ? TONES.active : TONES.expired;
    return (
        <Badge
            overlap="circular"
            badgeContent={count > 0 ? count : undefined}
            sx={{
                '& .MuiBadge-badge': {
                    bgcolor: tone.color,
                    color: '#fff',
                    fontSize: 9.5,
                    fontWeight: 700,
                    minWidth: 16,
                    height: 16,
                    px: '4px',
                    top: 5,
                    right: 5,
                    border: '1.5px solid #fff',
                    pointerEvents: 'none',
                },
            }}
        >
            <PickersDay
                {...other}
                day={day}
                outsideCurrentMonth={outsideCurrentMonth}
                sx={
                    count > 0
                        ? {
                              '&:not(.Mui-selected)': {
                                  bgcolor: tone.bg,
                                  color: tone.color,
                                  fontWeight: 700,
                              },
                          }
                        : undefined
                }
            />
        </Badge>
    );
};

const ExpiryCalendar = ({ open, onClose, files, geotabData, onEditFile, onUploadClick, mobile }) => {
    // Follow the app's own mobile switch (App.js: window.innerWidth < 1200) so the
    // calendar goes full screen exactly when the rest of the UI does.
    const fullScreen = !!mobile;

    const [month, setMonth] = useState(() => dayjs().startOf('month'));
    // One filter across vehicles, drivers, and trailers: { label, value, kind }.
    const [filter, setFilter] = useState(null);
    const [selectedDate, setSelectedDate] = useState(null);

    // DateCalendar re-centers the view whenever its `value` REFERENCE changes (its
    // recenter effect depends on the raw object). A fresh dayjs built inline on every
    // render would snap the view back to the selected day's month on each re-render —
    // freezing the month arrows once any day is selected. Keep the instance stable.
    const selectedDayValue = useMemo(
        () => (selectedDate ? dayjs(selectedDate) : null),
        [selectedDate]
    );

    // Fresh view each time the popup opens; the filter choice is kept on purpose.
    useEffect(() => {
        if (open) {
            setMonth(dayjs().startOf('month'));
            setSelectedDate(null);
        }
    }, [open]);

    // All filterable entities in one list, grouped Vehicles -> Drivers -> Trailers,
    // each sorted by name within its group.
    const filterOptions = useMemo(() => {
        const byLabel = (a, b) => String(a.label).localeCompare(String(b.label));
        return ['vehicles', 'drivers', 'trailers'].flatMap((kind) => {
            const list = Array.isArray(geotabData?.[kind]) ? [...geotabData[kind]] : [];
            return list.sort(byLabel).map((o) => ({ ...o, kind }));
        });
    }, [geotabData]);

    // Live Geotab name wins; otherwise the file's saved display name (geotabData is a
    // filtered subset, so unlinked/deactivated assets miss); the raw entry is last
    // (it IS the label on legacy documents that stored names instead of ids).
    const ownerLabel = (kind, id, savedName) => {
        const list = Array.isArray(geotabData?.[kind]) ? geotabData[kind] : [];
        const match = list.find((o) => o.value === id);
        if (match) return match.label;
        if (savedName != null && savedName !== '') return savedName;
        return id;
    };

    // Only documents with a parseable expiry date can be placed on the calendar,
    // narrowed to the chosen vehicle/driver/trailer when one is selected. Owners
    // hold Geotab ids, but legacy documents may still hold the display label —
    // match either.
    const datedFiles = useMemo(() => {
        const withDates = files.filter((f) => f.expiryDate && dayjs(f.expiryDate).isValid());
        if (!filter) return withDates;
        return withDates.filter((f) => {
            const owners = Array.isArray(f.owners?.[filter.kind]) ? f.owners[filter.kind] : [];
            return owners.some((v) => v === filter.value || v === filter.label);
        });
    }, [files, filter]);

    const filesByDay = useMemo(() => {
        const map = new Map();
        datedFiles.forEach((f) => {
            const key = dayjs(f.expiryDate).format('YYYY-MM-DD');
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(f);
        });
        map.forEach((list) => list.sort((a, b) => a.fileName.localeCompare(b.fileName)));

        // Today's cell rolls up everything already expired, so its badge shows the
        // full backlog and clicking it lists today's plus all past-due documents
        // (oldest first), each still shown on its own date as well.
        const todayKey = dayjs().format('YYYY-MM-DD');
        const pastDue = datedFiles
            .filter((f) => dayjs(f.expiryDate).isBefore(dayjs(), 'day'))
            .sort((a, b) => {
                const byDate = dayjs(a.expiryDate).valueOf() - dayjs(b.expiryDate).valueOf();
                return byDate !== 0 ? byDate : a.fileName.localeCompare(b.fileName);
            });
        if (pastDue.length) {
            map.set(todayKey, [...pastDue, ...(map.get(todayKey) || [])]);
        }
        return map;
    }, [datedFiles]);

    const monthCount = useMemo(
        () => datedFiles.filter((f) => dayjs(f.expiryDate).isSame(month, 'month')).length,
        [datedFiles, month]
    );

    const selectedFiles = selectedDate ? filesByDay.get(selectedDate) || [] : [];

    const handleEdit = (file) => {
        if (onEditFile) onEditFile(file);
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            fullScreen={fullScreen}
            PaperProps={{ sx: fullScreen ? {} : { borderRadius: '16px' } }}
        >
            <DialogTitle
                sx={{
                    m: 0,
                    p: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid #eef2f7',
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <EventBusyOutlinedIcon color="primary" />
                    Expiration Calendar
                </Box>
                <IconButton
                    aria-label="close calendar"
                    onClick={onClose}
                    sx={{ color: (t) => t.palette.grey[500] }}
                >
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{ p: { xs: 1.5, md: 2.5 } }}>
                {/* Controls: month summary + owner filter (vehicle / driver / trailer) */}
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 1.5,
                        mb: 1.5,
                        pt: 1,
                    }}
                >
                    <Box>
                        <Typography sx={{ fontWeight: 700, fontSize: 18, color: '#1f2937', lineHeight: 1.2 }}>
                            {month.format('MMMM YYYY')}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#64748b' }}>
                            {monthCount === 0
                                ? 'No documents expire this month'
                                : `${monthCount} document${monthCount === 1 ? '' : 's'} expir${monthCount === 1 ? 'es' : 'e'} this month`}
                            {filter ? ` for ${filter.label}` : ''}
                        </Typography>
                    </Box>

                    <Autocomplete
                        options={filterOptions}
                        value={filter}
                        onChange={(e, newValue) => {
                            setFilter(newValue);
                            setSelectedDate(null);
                        }}
                        groupBy={(option) => KIND_META[option.kind].group}
                        getOptionLabel={(option) => option.label || ''}
                        isOptionEqualToValue={(option, val) =>
                            val != null && option.kind === val.kind && option.value === val.value
                        }
                        disabled={filterOptions.length === 0}
                        size="small"
                        sx={{ width: { xs: '100%', sm: 300 } }}
                        renderInput={(params) => {
                            const FilterIcon = filter ? KIND_META[filter.kind].Icon : FilterAltOutlinedIcon;
                            return (
                                <TextField
                                    {...params}
                                    label="Vehicle, Driver or Trailer"
                                    placeholder="All documents"
                                    InputProps={{
                                        ...params.InputProps,
                                        startAdornment: (
                                            <>
                                                <FilterIcon sx={{ fontSize: 18, color: '#94a3b8', ml: 0.5 }} />
                                                {params.InputProps.startAdornment}
                                            </>
                                        ),
                                    }}
                                />
                            );
                        }}
                    />
                </Box>

                {datedFiles.length === 0 ? (
                    /* Nothing to place on the calendar at all: explain why instead of a bare picker */
                    <Box
                        sx={{
                            border: '1px dashed #e2e8f0',
                            borderRadius: '12px',
                            py: 5,
                            px: 2,
                            textAlign: 'center',
                            color: '#94a3b8',
                        }}
                    >
                        <EventOutlinedIcon sx={{ fontSize: 36, color: '#cbd5e1' }} />
                        <Typography sx={{ fontWeight: 600, color: '#64748b', mt: 1 }}>
                            {filter
                                ? `No documents with expiry dates for ${filter.label}`
                                : 'No documents with expiry dates'}
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 0.5 }}>
                            {filter
                                ? 'Clear the filter or pick another vehicle, driver, or trailer.'
                                : 'Upload files or add expiry dates to existing documents to see them here.'}
                        </Typography>
                        {!filter && onUploadClick && (
                            <Button
                                variant="contained"
                                size="small"
                                onClick={onUploadClick}
                                sx={{ mt: 2, textTransform: 'none', fontWeight: 600, borderRadius: '8px' }}
                            >
                                Upload Files
                            </Button>
                        )}
                    </Box>
                ) : (
                    <Box
                        sx={{
                            display: 'flex',
                            flexDirection: { xs: 'column', md: 'row' },
                            gap: 2,
                            alignItems: { xs: 'stretch', md: 'flex-start' },
                        }}
                    >
                        {/* Date picker with circled per-day document counts */}
                        <Box
                            sx={{
                                border: '1px solid #eef2f7',
                                borderRadius: '12px',
                                flexShrink: 0,
                                alignSelf: { xs: 'center', md: 'flex-start' },
                            }}
                        >
                            <LocalizationProvider dateAdapter={AdapterDayjs}>
                                <DateCalendar
                                    value={selectedDayValue}
                                    onChange={(d) => setSelectedDate(d ? d.format('YYYY-MM-DD') : null)}
                                    onMonthChange={(m) => setMonth(m.startOf('month'))}
                                    onYearChange={(y) => setMonth(y.startOf('month'))}
                                    slots={{ day: DayWithBadge }}
                                    slotProps={{ day: { filesByDay } }}
                                    sx={{
                                        '& .MuiPickersCalendarHeader-label': { fontWeight: 700 },
                                    }}
                                />
                            </LocalizationProvider>
                        </Box>

                        {/* Day panel: every document expiring on the selected day, with edit links */}
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            {!selectedDate ? (
                                <Box
                                    sx={{
                                        border: '1px dashed #e2e8f0',
                                        borderRadius: '12px',
                                        py: 5,
                                        px: 2,
                                        textAlign: 'center',
                                        color: '#94a3b8',
                                    }}
                                >
                                    <Typography sx={{ fontWeight: 600, color: '#64748b' }}>
                                        Select a date
                                    </Typography>
                                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                                        Dates with a circled number have documents expiring — pick one to
                                        see and edit them.
                                    </Typography>
                                </Box>
                            ) : (
                                <Box
                                    sx={{
                                        border: '1px solid #eef2f7',
                                        borderRadius: '12px',
                                        overflow: 'hidden',
                                    }}
                                >
                                    <Box sx={{ px: 2, py: 1.25, bgcolor: '#fbfcfe', borderBottom: '1px solid #eef2f7' }}>
                                        <Typography sx={{ fontWeight: 700, fontSize: 14, color: '#334155' }}>
                                            {dayjs(selectedDate).format('MMMM D, YYYY')} —{' '}
                                            {selectedFiles.length} document{selectedFiles.length === 1 ? '' : 's'}
                                        </Typography>
                                        {selectedDate === dayjs().format('YYYY-MM-DD') &&
                                            selectedFiles.some((f) => dayjs(f.expiryDate).isBefore(dayjs(), 'day')) && (
                                                <Typography variant="caption" sx={{ color: '#C2630B', fontWeight: 600 }}>
                                                    Includes all expired documents
                                                </Typography>
                                            )}
                                    </Box>
                                    {selectedFiles.length === 0 ? (
                                        <Typography sx={{ px: 2, py: 2, color: '#94a3b8', fontSize: 13.5 }}>
                                            No documents expire on this day{filter ? ` for ${filter.label}` : ''}.
                                        </Typography>
                                    ) : (
                                        selectedFiles.map((file) => {
                                            const expired = dayjs(file.expiryDate) < dayjs();
                                            const ownerLines = ['vehicles', 'drivers', 'trailers']
                                                .map((kind) => ({
                                                    kind,
                                                    // ownerNames is positionally aligned with owners (App.js contract)
                                                    names: Array.isArray(file.owners?.[kind])
                                                        ? file.owners[kind].map((id, i) =>
                                                              ownerLabel(kind, id, file.ownerNames?.[kind]?.[i])
                                                          )
                                                        : [],
                                                }))
                                                .filter((line) => line.names.length > 0);
                                            return (
                                                <Box
                                                    key={file.id}
                                                    sx={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 1.5,
                                                        px: 2,
                                                        py: 1.25,
                                                        borderBottom: '1px solid #f1f5f9',
                                                        '&:last-of-type': { borderBottom: 'none' },
                                                        '&:hover': { bgcolor: '#f8fafc' },
                                                    }}
                                                >
                                                    <FileTypeGlyph fileName={file.fileName} size={36} iconSize={20} radius={9} />
                                                    <Box sx={{ minWidth: 0, flex: 1 }}>
                                                        <Typography
                                                            sx={{
                                                                fontWeight: 600,
                                                                fontSize: 14,
                                                                color: '#1f2937',
                                                                whiteSpace: 'nowrap',
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis',
                                                            }}
                                                            title={file.fileName}
                                                        >
                                                            {file.fileName}
                                                        </Typography>
                                                        {ownerLines.map(({ kind, names }) => {
                                                            const KindIcon = KIND_META[kind].Icon;
                                                            return (
                                                                <Box key={kind} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
                                                                    <KindIcon sx={{ fontSize: 14, color: '#94a3b8', flexShrink: 0 }} />
                                                                    <Typography
                                                                        sx={{
                                                                            fontSize: 12.5,
                                                                            color: '#64748b',
                                                                            whiteSpace: 'nowrap',
                                                                            overflow: 'hidden',
                                                                            textOverflow: 'ellipsis',
                                                                        }}
                                                                    >
                                                                        {names.join(', ')}
                                                                    </Typography>
                                                                </Box>
                                                            );
                                                        })}
                                                    </Box>
                                                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.25, flexShrink: 0 }}>
                                                        <StatusPill expired={expired} />
                                                        {dayjs(file.expiryDate).format('YYYY-MM-DD') !== selectedDate && (
                                                            <Typography variant="caption" sx={{ color: '#94a3b8', whiteSpace: 'nowrap' }}>
                                                                {dayjs(file.expiryDate).format('MMM D, YYYY')}
                                                            </Typography>
                                                        )}
                                                    </Box>
                                                    <Button
                                                        size="small"
                                                        variant="outlined"
                                                        startIcon={<EditOutlinedIcon sx={{ fontSize: 16 }} />}
                                                        onClick={() => handleEdit(file)}
                                                        sx={{
                                                            textTransform: 'none',
                                                            fontWeight: 600,
                                                            borderRadius: '8px',
                                                            borderColor: '#e5e7eb',
                                                            color: '#334155',
                                                            flexShrink: 0,
                                                            '&:hover': { borderColor: '#cbd5e1', bgcolor: '#f8fafc' },
                                                        }}
                                                    >
                                                        Edit
                                                    </Button>
                                                </Box>
                                            );
                                        })
                                    )}
                                </Box>
                            )}
                        </Box>
                    </Box>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default ExpiryCalendar;
