import React from 'react';
import { SvgIcon } from '@mui/material';

// Custom flatbed trailer glyph (MUI has no flatbed icon): a flat deck on a tandem
// axle with a tow tongue at the front. Outlined to match the other column icons.
const FlatbedTrailerIcon = (props) => (
    <SvgIcon viewBox="0 0 24 24" {...props}>
        <g
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            {/* tow tongue */}
            <path d="M2 11.5h3.2" />
            {/* flat deck */}
            <rect x="5" y="10.4" width="16" height="2.6" rx="0.6" />
            {/* drops to the axle */}
            <path d="M9 13v1.4M17 13v1.4" />
            {/* tandem wheels */}
            <circle cx="10" cy="16.6" r="1.9" />
            <circle cx="16" cy="16.6" r="1.9" />
        </g>
    </SvgIcon>
);

export default FlatbedTrailerIcon;
