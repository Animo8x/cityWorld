# CityWorld — Unity Engine + C# Setup Guide

This folder contains the modular C# architecture for **CityWorld** (`Assets/Scripts/...`).

## Folder Structure
- `Assets/Scripts/Core/` — `Interfaces.cs`, `CurrencyManager.cs`, `ObjectPool.cs`
- `Assets/Scripts/Player/` — `PlayerController.cs`, `ThirdPersonCamera.cs`
- `Assets/Scripts/Vehicles/` — `VehicleDataSO.cs`, `VehicleController.cs`
- `Assets/Scripts/AI/` — `TrafficSystem.cs` (`WaypointNode`, `TrafficLightController`, `TrafficVehicleAI`, `TrafficManager`)
- `Assets/Scripts/NPC/` — `PedestrianAI.cs`
- `Assets/Scripts/Police/` — `WantedSystem.cs` (`WantedSystem`, `PoliceAI`)
- `Assets/Scripts/Missions/` — `MissionManager.cs` (`MissionDataSO`, `MissionManager`)
- `Assets/Scripts/World/` — `WorldStreamingManager.cs` (`WorldStreamingManager`, `InteriorPortal`)
- `Assets/Scripts/Environment/` — `DayNightWeather.cs`
- `Assets/Scripts/Audio/` — `AudioManager.cs`
- `Assets/Scripts/UI/` — `CityWorldHUD.cs`

## Manual Unity Editor Setup Steps
1. **Create URP 3D Project** (Unity 2022.3 LTS or Unity 6) and import `com.unity.ai.navigation` (AI Navigation) + `com.unity.textmeshpro`.
2. **Copy `Assets/Scripts/`** into your Unity project's `Assets/` folder.
3. **Bake NavMesh**: Add a `NavMeshSurface` to the city terrain/sidewalks and bake for `PedestrianAI` & `PoliceAI`.
4. **Create Vehicle Prefabs**: Attach `VehicleController` + `Rigidbody` + 4 `WheelCollider`s + `VehicleDataSO` ScriptableObjects (`Compact`, `Sedan`, `SUV`, `Sports`, `Luxury`, `Truck`, `Van`, `Bus`, `Motorcycle`, `Police`).
5. **Create Mission ScriptableObjects**: `Right-Click -> Create -> CityWorld -> Mission Data` to add hundreds of custom missions without writing new code.
6. **Scene Streaming**: Split the 10 districts into additive scenes (`Downtown`, `CrestwoodHills`, `MapleOaks`, `Brickyard`, `Ironworks`, `Harbor`, `AzureCoast`, `SkylineAirport`, `PinecrestValley`, `RingExpressway`) and register them in `WorldStreamingManager`.
7. **AudioMixer**: Create `MasterMixer` with exposed parameters `MasterVol`, `SFXVol`, `EngineVol`, and `AmbienceVol`.
