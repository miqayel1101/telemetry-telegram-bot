import { AlertFormatterService } from './alert-formatter.service';
import { IGeofenceStreamEvent } from './interfaces';

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
      const result = service.format(makeEvent());
      expect(result.parseMode).toBe('HTML');
    });

    it('ENTRY event uses ➡️ arrow and "Entered" in text', () => {
      const result = service.format(makeEvent({ eventType: 'ENTRY' }));
      expect(result.text).toContain('➡️');
      expect(result.text).toContain('Entered');
    });

    it('EXIT event uses ⬅️ arrow and "Exited" in text', () => {
      const result = service.format(makeEvent({ eventType: 'EXIT' }));
      expect(result.text).toContain('⬅️');
      expect(result.text).toContain('Exited');
    });

    it('includes vehicle plate in text', () => {
      const result = service.format(makeEvent({ vehiclePlate: 'XYZ-999' }));
      expect(result.text).toContain('XYZ-999');
    });

    it('includes vehicle label when present', () => {
      const result = service.format(makeEvent({ vehicleLabel: 'My Truck' }));
      expect(result.text).toContain('My Truck');
    });

    it('omits vehicle label line when null', () => {
      const result = service.format(makeEvent({ vehicleLabel: null }));
      expect(result.text).not.toContain('null');
    });

    it('includes geofence name in text', () => {
      const result = service.format(makeEvent({ geofenceName: 'Main Gate' }));
      expect(result.text).toContain('Main Gate');
    });

    it('includes driver name when present', () => {
      const result = service.format(makeEvent({ driverName: 'Jane Smith' }));
      expect(result.text).toContain('Jane Smith');
    });

    it('omits driver line when driverName is null', () => {
      const result = service.format(makeEvent({ driverName: null }));
      expect(result.text).not.toContain('Driver');
    });

    it('builds inline keyboard with loc and veh buttons for vehicleId', () => {
      const result = service.format(makeEvent({ vehicleId: 42 }));
      expect(result.inlineKeyboard).toHaveLength(1);
      expect(result.inlineKeyboard[0]).toHaveLength(2);
      expect(result.inlineKeyboard[0][0].callback_data).toBe('loc:42');
      expect(result.inlineKeyboard[0][1].callback_data).toBe('veh:42');
    });

    it('HTML-escapes special characters in plate', () => {
      const result = service.format(makeEvent({ vehiclePlate: '<ABC>&"123"' }));
      expect(result.text).toContain('&lt;ABC&gt;&amp;&quot;123&quot;');
      expect(result.text).not.toContain('<ABC>');
    });

    it('HTML-escapes special characters in geofence name', () => {
      const result = service.format(makeEvent({ geofenceName: 'Zone <A> & "B"' }));
      expect(result.text).toContain('Zone &lt;A&gt; &amp; &quot;B&quot;');
    });

    it('includes timestamp formatted as UTC string', () => {
      const ts = '2026-04-25T10:00:00.000Z';
      const result = service.format(makeEvent({ timestamp: ts }));
      expect(result.text).toContain(new Date(ts).toUTCString());
    });
  });
});
