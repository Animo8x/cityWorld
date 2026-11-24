using System;
using System.Collections.Generic;
using UnityEngine;

namespace CityWorld.Multiplayer
{
    public enum VehicleRole
    {
        None,
        Driver,
        Passenger
    }

    [Serializable]
    public struct VehicleSeatSlot
    {
        public Vector3 localOffset;
        public string occupantPlayerId;
        public bool IsOccupied => !string.IsNullOrEmpty(occupantPlayerId);
    }

    /// <summary>
    /// Multi-seat passenger and driver assignment system for CityWorld shared vehicles.
    /// Seat 0 is always Driver (only Player with vehicle steering authority). Seats 1..N are Passengers.
    /// </summary>
    public class PassengerSeatSystem : MonoBehaviour
    {
        [SerializeField]
        private List<VehicleSeatSlot> seats = new List<VehicleSeatSlot>
        {
            new VehicleSeatSlot { localOffset = new Vector3(-0.55f, 0.35f, 0.15f), occupantPlayerId = "" },
            new VehicleSeatSlot { localOffset = new Vector3(0.55f, 0.35f, 0.15f), occupantPlayerId = "" },
            new VehicleSeatSlot { localOffset = new Vector3(-0.55f, 0.35f, -0.75f), occupantPlayerId = "" },
            new VehicleSeatSlot { localOffset = new Vector3(0.55f, 0.35f, -0.75f), occupantPlayerId = "" }
        };

        public int SeatCapacity => seats.Count;

        public bool HasDriver => seats.Count > 0 && seats[0].IsOccupied;

        public bool IsVehicleFull
        {
            get
            {
                for (int i = 0; i < seats.Count; i++)
                {
                    if (!seats[i].IsOccupied) return false;
                }
                return true;
            }
        }

        public bool TryAssignPlayer(string playerId, out int assignedSeatIndex, out VehicleRole role)
        {
            for (int i = 0; i < seats.Count; i++)
            {
                if (!seats[i].IsOccupied)
                {
                    var slot = seats[i];
                    slot.occupantPlayerId = playerId;
                    seats[i] = slot;
                    assignedSeatIndex = i;
                    role = i == 0 ? VehicleRole.Driver : VehicleRole.Passenger;
                    return true;
                }
            }

            assignedSeatIndex = -1;
            role = VehicleRole.None;
            return false;
        }

        public void RemovePlayer(string playerId)
        {
            for (int i = 0; i < seats.Count; i++)
            {
                if (seats[i].occupantPlayerId == playerId)
                {
                    var slot = seats[i];
                    slot.occupantPlayerId = string.Empty;
                    seats[i] = slot;
                }
            }
        }

        public Vector3 GetSeatWorldPosition(int seatIndex)
        {
            if (seatIndex < 0 || seatIndex >= seats.Count) return transform.position;
            return transform.TransformPoint(seats[seatIndex].localOffset);
        }
    }
}
