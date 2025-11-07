import React, { useState, useEffect } from 'react';
import {
    Box,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    AccordionActions,
    Typography,
    Chip,
    Button,
} from '@mui/material';
import DebouncedInput from './DebouncedInput';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { generateCSV } from '../utils/csv-generator';
import { CSVLink } from 'react-csv';
import dayjs from 'dayjs';

const DocumentMobile = ({ files, onOpenUploader }) => {
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
                                <Typography variant="h5">
                                    {file.fileName}
                                </Typography>
                            </AccordionSummary>
                            <AccordionDetails
                                sx={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '1rem',
                                }}
                            >
                                {file.owners.groups.length > 0 && (
                                    <Box>
                                        <Typography variant="h6">
                                            Groups
                                        </Typography>
                                        <Typography variant="body1">
                                            {file.owners.groups.join(', ')}
                                        </Typography>
                                    </Box>
                                )}
                                {file.owners.drivers.length > 0 && (
                                    <Box>
                                        <Typography variant="h6">
                                            Drivers
                                        </Typography>
                                        <Typography variant="body1">
                                            {file.owners.drivers.join(', ')}
                                        </Typography>
                                    </Box>
                                )}
                                {file.owners.vehicles.length > 0 && (
                                    <Box>
                                        <Typography variant="h6">
                                            Vehicles
                                        </Typography>
                                        <Typography variant="body1">
                                            {file.owners.vehicles.join(', ')}
                                        </Typography>
                                    </Box>
                                )}
                                {file.owners.trailers.length > 0 && (
                                    <Box>
                                        <Typography variant="h6">
                                            Trailers
                                        </Typography>
                                        <Typography variant="body1">
                                            {file.owners.trailers.join(', ')}
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
                                                'LL'
                                            )}{' '}
                                        </Typography>
                                        {hasExpired ? (
                                            <Chip
                                                label="Expired"
                                                color="error"
                                            />
                                        ) : (
                                            <Chip
                                                label="Active"
                                                color="primary"
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
