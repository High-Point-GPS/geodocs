import React, { useState, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Box, Typography } from '@mui/material';
import Spinner from './Spinner';

// react-pdf draws to <canvas>, so PDFs preview on mobile too (mobile browsers have no
// inline PDF viewer for iframes). Use the CLASSIC .js worker (pdfjs 3): webpack emits it as
// a bundled asset (<publicPath>pdf.worker.min.js) served same-origin from GitHub Pages with
// the correct text/javascript MIME — a .mjs worker is rejected by GitHub Pages' MIME type.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.js',
    import.meta.url
).toString();

const Fallback = ({ msg }) => (
    <Box
        sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1,
            color: '#94a3b8',
            textAlign: 'center',
            px: 3,
            py: 4,
        }}
    >
        <Typography variant="body2">{msg}</Typography>
        <Typography variant="caption">Use the Download button below to open it.</Typography>
    </Box>
);

const PdfCanvas = ({ blobUrl, zoom = 1 }) => {
    const containerRef = useRef(null);
    const [containerWidth, setContainerWidth] = useState(0);
    const [numPages, setNumPages] = useState(0);
    const [failed, setFailed] = useState(false);

    // Fit pages to the available width (responsive on mobile); zoom multiplies it.
    useEffect(() => {
        const el = containerRef.current;
        if (!el || typeof ResizeObserver === 'undefined') return undefined;
        const update = () => setContainerWidth(el.clientWidth);
        update();
        const ro = new ResizeObserver(update);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const pageWidth = Math.max(140, (containerWidth - 24) * zoom);

    if (!blobUrl) return null;

    return (
        <Box
            ref={containerRef}
            sx={{
                width: '100%',
                height: '100%',
                overflow: 'auto',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 1.5,
                py: 1,
            }}
        >
            {failed ? (
                <Fallback msg="Couldn’t render this PDF." />
            ) : (
                <Document
                    file={blobUrl}
                    onLoadSuccess={({ numPages: n }) => setNumPages(n)}
                    onLoadError={() => setFailed(true)}
                    loading={
                        <Box sx={{ py: 4 }}>
                            <Spinner size={36} />
                        </Box>
                    }
                    error={<Fallback msg="Couldn’t render this PDF." />}
                >
                    {containerWidth > 0 &&
                        Array.from({ length: numPages }, (_, i) => (
                            <Box
                                key={i}
                                sx={{
                                    boxShadow: '0 1px 8px rgba(16,24,40,0.15)',
                                    borderRadius: '4px',
                                    overflow: 'hidden',
                                    bgcolor: '#fff',
                                }}
                            >
                                <Page
                                    pageNumber={i + 1}
                                    width={pageWidth}
                                    renderTextLayer={false}
                                    renderAnnotationLayer={false}
                                    loading=""
                                />
                            </Box>
                        ))}
                </Document>
            )}
        </Box>
    );
};

export default PdfCanvas;
