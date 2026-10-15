import { AlertFormatterService } from './alert-formatter.service';
import { IGeofenceStreamEvent } from './interfaces';
import { LanguageEnum } from '../i18n';
import { createTestI18nService } from '../i18n/i18n.testing';

const en = createTestI18nService().translator(LanguageEnum.EN);
const hy = createTestI18nService().translator(LanguageEnum.HY);

function makeEvent(overrides: Partial<IGeofenceStreamEvent> = {}): IGeofenceStreamEvent {
  return {
    eventId: 'evt-001',
    fleetId: 1,
    vehicleId: 42,
    vehiclePlate: 'ABC-123',
    vehicleLabel: 'Truck Alpha',
    geofenceId: 10,
    geofenceName: 'Warehouse Zone',
    eventType: 'ENTRY',
    timestamp: '2026-04-25T10:00:00.000Z',
    location: { lat: 40.1, lng: 44.5 },
    driverName: 'John Doe',
    ...overrides,
  };
}

describe('AlertFormatterService', () => {
  let service: AlertFormatterService;

  beforeEach(() => {
    service = new AlertFormatterService();
  });

  describe('format()', () => {
    it('returns HTML parse mode', () => {
      const result = service.format(makeEvent(), en);
      expect(result.parseMode).toBe('HTML');
    });

    it('ENTRY event uses ➡️ arrow and "Entered" in text', () => {
      const result = service.format(makeEvent({ eventType: 'ENTRY' }), en);
      expect(result.text).toContain('➡️');
      expect(result.text).toContain('Entered');
    });

    it('EXIT event uses ⬅️ arrow and "Left the zone" in text', () => {
      const result = service.format(makeEvent({ eventType: 'EXIT' }), en);
      expect(result.text).toContain('⬅️');
      expect(result.text).toContain('Left the zone');
    });

    it('includes vehicle plate in text', () => {
      const result = service.format(makeEvent({ vehiclePlate: 'XYZ-999' }), en);
      expect(result.text).toContain('XYZ-999');
    });

    it('includes vehicle label when present', () => {
      const result = service.format(makeEvent({ vehicleLabel: 'My Truck' }), en);
      expect(result.text).toContain('My Truck');
    });

    it('omits vehicle label line when null', () => {
      const result = service.format(makeEvent({ vehicleLabel: null }), en);
      expect(result.text).not.toContain('null');
    });

    it('includes geofence name in text', () => {
      const result = service.format(makeEvent({ geofenceName: 'Main Gate' }), en);
      expect(result.text).toContain('Main Gate');
    });

    it('includes driver name when present', () => {
      const result = service.format(makeEvent({ driverName: 'Jane Smith' }), en);
      expect(result.text).toContain('Jane Smith');
    });

    it('omits driver line when driverName is null', () => {
      const result = service.format(makeEvent({ driverName: null }), en);
      expect(result.text).not.toContain('Driver');
    });

    it('builds a "show on map" button for the vehicle', () => {
      const result = service.format(makeEvent({ vehicleId: 42 }), en);
      expect(result.inlineKeyboard).toEqual([
        [{ text: '📍 Show on map', callback_data: 'loc:42' }],
      ]);
    });

    it('HTML-escapes special characters in plate', () => {
      const result = service.format(makeEvent({ vehiclePlate: '<ABC>&"123"' }), en);
      expect(result.text).toContain('&lt;ABC&gt;&amp;&quot;123&quot;');
      expect(result.text).not.toContain('<ABC>');
    });

    it('HTML-escapes special characters in geofence name', () => {
      const result = service.format(makeEvent({ geofenceName: 'Zone <A> & "B"' }), en);
      expect(result.text).toContain('Zone &lt;A&gt; &amp; &quot;B&quot;');
    });

    it('shows the time in Armenian local time (UTC+4)', () => {
      const result = service.format(makeEvent({ timestamp: '2026-04-25T10:00:00.000Z' }), en);
      expect(result.text).toContain('14:00');
    });

    it('writes the alert in the chat language', () => {
      const result = service.format(makeEvent({ eventType: 'EXIT' }), hy);
      expect(result.text).toContain('Գեոզոնայի ահազանգ');
      expect(result.text).toContain('Դուրս եկավ գոտուց');
      expect(result.inlineKeyboard[0][0].text).toBe('📍 Ցույց տալ քարտեզում');
    });
  });
});

describe('AlertFormatterService – fleet alerts (speeding, offline, maintenance)', () => {
  const service = new AlertFormatterService();
  const base = makeEvent({ geofenceId: null, geofenceName: '' });

  it('speeding shows the speed and the fleet limit', () => {
    const r = service.format({ ...base, eventType: 'SPEEDING', details: { speed: 112.4, limitKmh: 90 } }, en);
    expect(r.text).toContain('Speeding');
    expect(r.text).toContain('112 km/h, limit 90 km/h');
    expect(r.inlineKeyboard?.[0]?.[0]?.callback_data).toBe('loc:42');
  });

  it('offline shows how long the car has been silent', () => {
    const r = service.format({ ...base, eventType: 'OFFLINE', details: { offlineMinutes: 30 } }, hy);
    expect(r.text).toContain('Կապ չկա');
    expect(r.text).toContain('30 րոպե');
  });

  it('maintenance names the task and what is left, in the chat language', () => {
    const r = service.format(
      { ...base, eventType: 'MAINTENANCE', details: { kind: 'OIL_CHANGE', state: 'DUE_SOON', leftKm: 450, taskId: 7 } },
      hy,
    );
    expect(r.text).toContain('Յուղի փոխարինում');
    expect(r.text).toContain('մնաց 450 կմ');
  });

  it('an overdue custom task uses its own name', () => {
    const r = service.format(
      { ...base, eventType: 'MAINTENANCE', details: { kind: 'CUSTOM', title: 'Wipers', state: 'OVERDUE', leftDays: -5 } },
      en,
    );
    expect(r.text).toContain('Wipers');
    expect(r.text).toContain('overdue by 5 days');
  });
});

