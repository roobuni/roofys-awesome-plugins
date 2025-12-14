import { PermissionStore } from "@webpack/common";
import { findByPropsLazy } from "@webpack";

const DiscordConstants = findByPropsLazy("Permissions", "ChannelTypes");

// READ_MESSAGE_HISTORY permission bit
const READ_MESSAGE_HISTORY = 1n << 16n;

export function canSeeHistory(channelId: string): boolean {
    if (!PermissionStore) return true;
    
    try {
        const permissions = PermissionStore.getChannelPermissions({ id: channelId });
        return (permissions & READ_MESSAGE_HISTORY) === READ_MESSAGE_HISTORY;
    } catch (e) {
        // Fallback: try using the can method
        try {
            return PermissionStore.can(READ_MESSAGE_HISTORY, { id: channelId });
        } catch {
            return true; // Assume we can see history if check fails
        }
    }
}
