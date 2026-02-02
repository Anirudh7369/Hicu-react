// src/components/KeyBackup.jsx
// Encryption key backup and restore component

import { useState } from 'react';
import PropTypes from 'prop-types';
import { exportAllKeys, importKeys, getAllChatIds } from '../crypto/keyStorage';

const KeyBackup = ({ onClose }) => {
  const [exportedKeys, setExportedKeys] = useState(null);
  const [importing, setImporting] = useState(false);

  const handleExport = async () => {
    try {
      const keys = await exportAllKeys();
      const chatIds = await getAllChatIds();

      setExportedKeys(JSON.stringify(keys, null, 2));

      console.log(`🔑 Exported ${chatIds.length} encryption keys`);
      alert(`Successfully exported ${chatIds.length} chat keys. Save this backup in a secure location!`);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export keys: ' + error.message);
    }
  };

  const handleDownload = () => {
    if (!exportedKeys) return;

    const blob = new Blob([exportedKeys], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hicu-keys-backup-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    alert('✅ Backup downloaded! Store this file securely.');
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setImporting(true);

      const text = await file.text();
      const keys = JSON.parse(text);

      await importKeys(keys);

      const count = Object.keys(keys).length;
      alert(`✅ Successfully imported ${count} encryption keys!`);

      if (onClose) onClose();
    } catch (error) {
      console.error('Import failed:', error);
      alert('Failed to import keys: ' + error.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1C1C1E] rounded-lg max-w-lg w-full p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-white text-xl font-bold">🔑 Encryption Key Backup</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Warning */}
        <div className="bg-yellow-900 bg-opacity-30 border border-yellow-600 rounded-lg p-4 mb-6">
          <p className="text-yellow-200 text-sm">
            ⚠️ <strong>Important:</strong> Your encryption keys are stored locally on this device.
            If you clear browser data or switch devices, you&apos;ll lose access to encrypted messages.
            Backup your keys regularly!
          </p>
        </div>

        {/* Export Section */}
        <div className="mb-6">
          <h3 className="text-white font-semibold mb-3">Export Keys (Backup)</h3>
          <p className="text-gray-400 text-sm mb-4">
            Create a backup of all your encryption keys to restore on another device.
          </p>

          <button
            onClick={handleExport}
            className="w-full bg-[#A076F9] hover:bg-[#8a5fd8] text-white py-3 rounded-lg font-medium mb-3"
          >
            📤 Export All Keys
          </button>

          {exportedKeys && (
            <button
              onClick={handleDownload}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-medium"
            >
              💾 Download Backup File
            </button>
          )}
        </div>

        {/* Import Section */}
        <div>
          <h3 className="text-white font-semibold mb-3">Import Keys (Restore)</h3>
          <p className="text-gray-400 text-sm mb-4">
            Restore encryption keys from a backup file.
          </p>

          <label className="w-full bg-[#2C2C2E] hover:bg-[#3a3a3c] text-white py-3 rounded-lg font-medium cursor-pointer flex items-center justify-center">
            <span className="material-symbols-outlined mr-2">upload_file</span>
            {importing ? 'Importing...' : '📥 Select Backup File'}
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
              disabled={importing}
            />
          </label>
        </div>

        {/* Security Note */}
        <div className="mt-6 p-4 bg-[#2C2C2E] rounded-lg">
          <p className="text-gray-400 text-xs">
            🔒 <strong>Security tip:</strong> Store your backup file in a secure location (password manager, encrypted drive).
            Anyone with this file can decrypt your messages.
          </p>
        </div>
      </div>
    </div>
  );
};

KeyBackup.propTypes = {
  onClose: PropTypes.func.isRequired,
};

export default KeyBackup;
