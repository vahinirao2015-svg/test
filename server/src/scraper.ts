import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

export type FetchParams = {
  baseUrl: string;
  username?: string;
  password?: string;
};

export type AttendanceRecord = {
  id: string;
  date: string;
  status: string;
  remarks?: string;
};

// This is a placeholder implementation assuming a public page or a simple session-less fetch.
// Replace selector logic with the actual website structure.
export async function fetchAttendanceFromWebsite(params: FetchParams): Promise<AttendanceRecord[]> {
  const { baseUrl } = params;
  const url = `${baseUrl.replace(/\/$/, '')}/attendance`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'AttendanceFetcher/1.0'
    }
  });
  if (!response.ok) {
    // Upstream not available; return sample so app remains usable.
    return sampleData();
  }
  const html = await response.text();
  const $ = cheerio.load(html);

  const rows: AttendanceRecord[] = [];
  $('table.attendance tbody tr').each((_, el) => {
    const tds = $(el).find('td');
    const date = $(tds[0]).text().trim();
    const status = $(tds[1]).text().trim();
    const remarks = $(tds[2]).text().trim();
    const id = `${date}-${status}`.replace(/\s+/g, '_');
    if (date && status) {
      rows.push({ id, date, status, remarks });
    }
  });

  // Fallback: if no table found, return mocked sample so the app works out of box.
  if (rows.length === 0) {
    return sampleData();
  }
  return rows;
}

function sampleData(): AttendanceRecord[] {
  return [
    { id: '2024-10-01-present', date: '2024-10-01', status: 'Present' },
    { id: '2024-10-02-absent', date: '2024-10-02', status: 'Absent', remarks: 'Sick' },
    { id: '2024-10-03-present', date: '2024-10-03', status: 'Present' }
  ];
}
