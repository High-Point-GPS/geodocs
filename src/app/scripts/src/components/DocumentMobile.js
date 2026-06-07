import React, { useState, useEffect } from 'react';
import {
    Box,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    AccordionActions,
    Typography,
    Chip,
    Tooltip,
} from '@mui/material';
import DebouncedInput from './DebouncedInput';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { generateCSV } from '../utils/csv-generator';
import { CSVLink } from 'react-csv';
import dayjs from 'dayjs';

const DocumentMobile = ({ files, geotabData, onOrderedFilesChange }) => {
    const [globalFilter, setGlobalFilter] = useState('');
    const [expandedId, setExpandedId] = useState(null);
    const [filterFiles, setFilterFiles] = useState([]);

    useEffect(() => {
        if (globalFilter === '') {
            setFilterFiles([...files]);
        } else {
            const newFilterFiles = files.filter((file) =>
                file.fileName.toLowerCase().includes(globalFilter.toLowerCase())
            );
            setFilterFiles(newFilterFiles);
        }
    }, [globalFilter, files]);

    // Report the visible order so the shared preview's prev/next matches this list.
    useEffect(() => {
        if (onOrderedFilesChange) onOrderedFilesChange(filterFiles);
    }, [filterFiles, onOrderedFilesChange]);

    const formatData = (dataIds, dataKey) => {
        return dataIds.map(id => {
            const data = geotabData[dataKey].find(d => d.value === id);
            return data ? data.label : id;
        });
    }

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                width: '100%',
                marginTop: '2rem',
            }}
        >
            <Box sx={{ display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ flex: 1 }}>
                    <DebouncedInput
                        value={globalFilter ?? ''}
                        onChange={(value) => setGlobalFilter(String(value))}
                        placeholder="Search all columns..."
                    />
                </Box>


                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        marginRight: '1rem',
                        fontSize: '18px',
                    }}
                >
                    <CSVLink data={generateCSV(files)} filename={'geodoc.csv'}>
                        Export CSV
                    </CSVLink>
                </Box>
            </Box>
            <Box sx={{ width: '100%' }}>
                {filterFiles.map((file) => {
                    // Mobile consumes the raw (un-normalized) file list, so guard owners here.
                    const owners = file.owners || {};
                    const groups = Array.isArray(owners.groups) ? owners.groups : [];
                    const drivers = Array.isArray(owners.drivers) ? owners.drivers : [];
                    const vehicles = Array.isArray(owners.vehicles) ? owners.vehicles : [];
                    const trailers = Array.isArray(owners.trailers) ? owners.trailers : [];

                    let hasExpired = false;
                    if (file.expiryDate) {
                        const currentDate = dayjs();
                        const expireDate = dayjs(file.expiryDate);

                        hasExpired = expireDate < currentDate;
                    }
                    return (
                        <Accordion
                            key={file.id}
                            expanded={file.id === expandedId}
                            onChange={() => {
                                expandedId === file.id
                                    ? setExpandedId(null)
                                    : setExpandedId(file.id);
                            }}
                        >
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Tooltip title={file.hideFromDriver ? 'Hidden from driver' : 'Visible to driver'} arrow>
                                        {file.hideFromDriver ? (
                                            <VisibilityOffIcon sx={{ fontSize: 18, color: '#94a3b8' }} />
                                        ) : (
                                            <VisibilityIcon sx={{ fontSize: 18, color: '#1B7A3D' }} />
                                        )}
                                    </Tooltip>
                                    <Typography variant="h5">
                                        {file.fileName}
                                    </Typography>
                                </Box>
                            </AccordionSummary>
                            <AccordionDetails
                                sx={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '1rem',
                                }}
                            >
                                {groups.length > 0 && (
                                    <Box>
                                        <Typography variant="h6">
                                            Groups
                                        </Typography>
                                        <Typography variant="body1">
                                            {groups.join(', ')}
                                        </Typography>
                                    </Box>
                                )}
                                {drivers.length > 0 && (
                                    <Box>
                                        <Typography variant="h6">
                                            Drivers
                                        </Typography>
                                        <Typography variant="body1">
                                            {formatData(drivers, 'drivers').join(', ')}
                                        </Typography>
                                    </Box>
                                )}
                                {vehicles.length > 0 && (
                                    <Box>
                                        <Typography variant="h6">
                                            Vehicles
                                        </Typography>
                                        <Typography variant="body1">
                                            {formatData(vehicles, 'vehicles').join(', ')}
                                        </Typography>
                                    </Box>
                                )}
                                {trailers.length > 0 && (
                                    <Box>
                                        <Typography variant="h6">
                                            Trailers
                                        </Typography>
                                        <Typography variant="body1">
                                            {formatData(trailers, 'trailers').join(', ')}
                                        </Typography>
                                    </Box>
                                )}
                                {file.expiryDate ? (
                                    <Box
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                        }}
                                    >
                                        <Typography>
                                            {dayjs(file.expiryDate).format(
                                                'MMMM D, YYYY'
                                            )}{' '}
                                        </Typography>
                                        {hasExpired ? (
                                            <Chip
                                                label="Expired"
                                                color="secondary"
                                                size="small"
                                                sx={{ color: 'white' }}
                                            />
                                        ) : (
                                            <Chip
                                                label="Active"
                                                color="primary"
                                                size="small"
                                            />
                                        )}
                                    </Box>
                                ) : (
                                    <Box
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                        }}
                                    >
                                        <Typography>None</Typography>

                                        <Chip label="Active" color="primary" />
                                    </Box>
                                )}
                            </AccordionDetails>
                            <AccordionActions>{file.action}</AccordionActions>
                        </Accordion>
                    );
                })}
            </Box>
        </Box>
    );
};

export default DocumentMobile;
