export function generateCSV(fileTable) {
    let csvData = [
        ['File', 'Type', 'Uploaded By', 'Notes', 'Groups', 'Vehicles', 'Drivers', 'Trailers', 'Expiry Date'],
    ];

    fileTable.forEach((fileData) => {
        const uploadedBy = fileData.uploadedBy;
        csvData.push([
            fileData.fileName || '',
            fileData.documentType || '',
            // Blank means an admin uploaded it from the web app.
            uploadedBy ? uploadedBy.driverName || uploadedBy.userName || 'Driver' : '',
            fileData.description || '',
            combineData((fileData.owners || {}).groups),
            combineData((fileData.owners || {}).vehicles),
            combineData((fileData.owners || {}).drivers),
            combineData((fileData.owners || {}).trailers),
            fileData.expiryDate ? convertDateToReadable(fileData.expiryDate) : 'None (Active)'
        ].map(neutralizeFormula));
    });

    return csvData;
}

function combineData(arrayData) {
    return Array.isArray(arrayData) ? arrayData.join(', ') : '';
}

// User-controlled text (file names, notes, driver names) opened in Excel/Sheets is
// evaluated as a formula when it starts with = + - @ (or tab/CR). Prefix a quote so
// it stays literal. react-csv wraps every cell in quotes but does NOT double embedded
// quotes for array data, so a `"` in a name would break the row — escape it here.
function neutralizeFormula(value) {
    const str = (value == null ? '' : String(value)).replace(/"/g, '""');
    return /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
}

function convertDateToReadable(iso) {
    const date = new Date(iso);
    let expired = false;

    if(date < new Date()) {
        expired = true;
    }

    return date.toLocaleDateString('en-US', {
        year:  'numeric',
        month: 'long',
        day:   'numeric'
      }) + ` (${expired ? 'Expired' : 'Active'})`
}
