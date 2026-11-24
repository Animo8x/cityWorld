using System;
using System.Collections.Generic;
using UnityEngine;

namespace CityWorld.Multiplayer
{
    public enum MultiplayerConnectionState
    {
        Offline,
        Connecting,
        Connected,
        Error
    }

    public enum NetworkQualityPreset
    {
        Low = 10,
        Balanced = 15,
        High = 20
    }

    [Serializable]
    public struct SessionInfo
    {
        public string sessionId;
        public string sessionCode;
        public string sessionName;
        public int playerCount;
        public int maxPlayers;
        public string region;
    }

    /// <summary>
    /// Modular CityWorld Online session orchestrator.
    /// Remains completely dormant during Offline Single Player so no network calls occur until explicitly requested.
    /// </summary>
    public class NetworkSessionManager : MonoBehaviour
    {
        [Header("Server Configuration")]
        [SerializeField] private string serverWebSocketUrl = "ws://localhost:3000/ws/multiplayer";
        [SerializeField] private NetworkQualityPreset qualityPreset = NetworkQualityPreset.Balanced;
        [SerializeField] private int defaultMaxPlayers = 8;

        [Header("Player Profile")]
        [SerializeField] private string customDisplayName = "";

        public MultiplayerConnectionState ConnectionState { get; private set; } = MultiplayerConnectionState.Offline;
        public string LocalPlayerId { get; private set; }
        public string ActiveDisplayName { get; private set; } = "Player 1";
        public string ActiveSessionCode { get; private set; }
        public int PingMs { get; private set; }

        private readonly Dictionary<string, NetworkPlayerSync> remotePlayers = new Dictionary<string, NetworkPlayerSync>();
        private readonly Dictionary<string, NetworkVehicleSync> remoteVehicles = new Dictionary<string, NetworkVehicleSync>();

        public event Action<string> OnConnectionError;
        public event Action<string> OnDisplayNameUpdated;

        private const string PrefNameKey = "cw_multiplayer_custom_name";

        private void Awake()
        {
            customDisplayName = PlayerPrefs.GetString(PrefNameKey, string.Empty);
        }

        public bool IsOnlineSessionActive => ConnectionState == MultiplayerConnectionState.Connected;

        public float SendIntervalSeconds => 1f / Mathf.Max(10, (int)qualityPreset);

        public void SetNetworkQuality(NetworkQualityPreset preset)
        {
            qualityPreset = preset;
        }

        public void RequestEnterMultiplayer(string sessionCodeOrEmpty, bool createNewSession, string newSessionName = "")
        {
            if (Application.internetReachability == NetworkReachability.NotReachable)
            {
                ConnectionState = MultiplayerConnectionState.Error;
                OnConnectionError?.Invoke("No internet connection. Multiplayer cannot be started right now.");
                return;
            }

            ConnectionState = MultiplayerConnectionState.Connecting;
            ActiveSessionCode = string.IsNullOrWhiteSpace(sessionCodeOrEmpty) ? "CW1001" : sessionCodeOrEmpty.Trim().ToUpperInvariant();
            int sendHz = (int)qualityPreset;
            Debug.Log($"[CityWorld Online] Connecting to {serverWebSocketUrl} (Room={ActiveSessionCode}, Create={createNewSession}, Name={newSessionName}, Max={defaultMaxPlayers}, Hz={sendHz})");
        }

        public void SetCustomPlayerName(string requestedName)
        {
            string cleaned = string.IsNullOrEmpty(requestedName) ? string.Empty : requestedName.Trim();
            if (cleaned.Length > 18) cleaned = cleaned.Substring(0, 18);

            customDisplayName = cleaned;
            PlayerPrefs.SetString(PrefNameKey, customDisplayName);
            PlayerPrefs.Save();

            if (!string.IsNullOrEmpty(customDisplayName))
            {
                ActiveDisplayName = customDisplayName;
                OnDisplayNameUpdated?.Invoke(ActiveDisplayName);
            }
        }

        public void LeaveMultiplayerSession()
        {
            foreach (var kv in remotePlayers)
            {
                if (kv.Value != null) Destroy(kv.Value.gameObject);
            }
            remotePlayers.Clear();

            foreach (var kv in remoteVehicles)
            {
                if (kv.Value != null) Destroy(kv.Value.gameObject);
            }
            remoteVehicles.Clear();

            ConnectionState = MultiplayerConnectionState.Offline;
            ActiveSessionCode = string.Empty;
        }

        public void RegisterRemotePlayer(string playerId, NetworkPlayerSync sync)
        {
            if (!string.IsNullOrEmpty(playerId) && sync != null)
            {
                remotePlayers[playerId] = sync;
            }
        }

        public void UnregisterRemotePlayer(string playerId)
        {
            if (remotePlayers.TryGetValue(playerId, out var sync))
            {
                if (sync != null) Destroy(sync.gameObject);
                remotePlayers.Remove(playerId);
            }
        }

        public void RegisterRemoteVehicle(string vehicleId, NetworkVehicleSync sync)
        {
            if (!string.IsNullOrEmpty(vehicleId) && sync != null)
            {
                remoteVehicles[vehicleId] = sync;
            }
        }
    }
}
