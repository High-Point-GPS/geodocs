import React from 'react';
import { SvgIcon } from '@mui/material';

// Custom flatbed trailer glyph (MUI has no flatbed icon): a flat deck with a hitch
// loop + tow tongue at the front, a jack leg, and tandem rear wheels. Outlined to
// match the weight/color of the other column icons.
const FlatbedTrailerIcon = (props) => (
    <SvgIcon viewBox="0 0 24 24" {...props}>
        <g
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            {/* hitch loop + tow tongue */}
            <circle cx="2.7" cy="12.3" r="0.9" />
            <path d="M3.6 12.3h2.4" />
            {/* flat deck */}
            <rect x="5.5" y="10.7" width="15.5" height="2.4" rx="0.8" />
            {/* front jack leg */}
            <path d="M7.3 13.1v2.4" />
            {/* tandem rear wheels */}
            <circle cx="15" cy="16.3" r="1.8" />
            <circle cx="18.4" cy="16.3" r="1.8" />
        </g>
    </SvgIcon>
);

export default FlatbedTrailerIcon;
