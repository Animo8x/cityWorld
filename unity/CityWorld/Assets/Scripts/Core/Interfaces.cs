using UnityEngine;

namespace CityWorld.Core
{
    public interface IInteractable
    {
        string InteractionPrompt { get; }
        void Interact(GameObject interactor);
    }

    public interface IDamageable
    {
        float CurrentHealth { get; }
        float MaxHealth { get; }
        void TakeDamage(float amount, Vector3 hitPoint);
    }
}
