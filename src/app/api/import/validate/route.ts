import { NextResponse } from 'next/server';
import Papa from 'papaparse';
import db from '@/lib/db';

const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;

export async function POST(request: Request) {
  try {
    const { csvData } = await request.json();
    if (!csvData) {
      return NextResponse.json({ error: 'No CSV data provided' }, { status: 400 });
    }

    const parsed = Papa.parse(csvData, {
      header: true,
      skipEmptyLines: true
    });

    if (parsed.errors.length > 0) {
      return NextResponse.json({ error: 'Failed to parse CSV', details: parsed.errors }, { status: 400 });
    }

    const data = parsed.data as any[];
    const existingProperties = db.prepare('SELECT property_id, gateway_ip FROM properties').all() as any[];
    
    const existingIds = new Set(existingProperties.map(p => p.property_id));
    const existingIps = new Set(existingProperties.map(p => p.gateway_ip));
    
    const seenIds = new Set();
    const seenIps = new Set();

    const results = data.map((row, index) => {
      const pid = row.property_id?.trim();
      const pname = row.property_name?.trim();
      const ip = row.gateway_ip?.trim();

      const errors = [];
      const warnings = [];

      // Required fields
      if (!pid) errors.push('Missing property_id');
      if (!pname) errors.push('Missing property_name');
      if (!ip) errors.push('Missing gateway_ip');

      // IP Validation
      if (ip && !ipv4Regex.test(ip)) {
        errors.push('Invalid IPv4 address format');
      }

      // Duplicates in DB
      if (pid && existingIds.has(pid)) {
        errors.push('Property ID already exists in database');
      }
      if (ip && existingIps.has(ip)) {
        warnings.push('Gateway IP already exists in database (different property?)');
      }

      // Duplicates in CSV
      if (pid) {
        if (seenIds.has(pid)) errors.push('Duplicate Property ID in CSV');
        seenIds.add(pid);
      }
      if (ip) {
        if (seenIps.has(ip)) warnings.push('Duplicate Gateway IP in CSV');
        seenIps.add(ip);
      }

      let status = 'VALID';
      if (errors.length > 0) status = 'INVALID';
      else if (warnings.length > 0) status = 'WARNING';

      return {
        rowNumber: index + 2, // Accounting for header
        property_id: pid,
        property_name: pname,
        gateway_ip: ip,
        status,
        messages: [...errors, ...warnings]
      };
    });

    const summary = {
      valid: results.filter(r => r.status === 'VALID').length,
      warning: results.filter(r => r.status === 'WARNING').length,
      invalid: results.filter(r => r.status === 'INVALID').length,
      total: results.length
    };

    return NextResponse.json({ summary, results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
