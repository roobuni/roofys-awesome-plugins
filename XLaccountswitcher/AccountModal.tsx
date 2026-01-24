import { Margins } from "@utils/margins";
import { ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalRoot, ModalSize, openModal } from "@utils/modal";
import { Button, Forms, showToast, Text, TextInput, Toasts, useState } from "@webpack/common";

import { Account, addAccount, deleteAccount, deleteInvalidAccount, getAccounts, getCurrentAccountInfo, getInvalidAccounts, getPinnedAccounts, isAccountPinned, massImportTokens, MassImportResult, pinAccount, refreshAllAccounts, retryValidateAccount, unpinAccount, updateAccount } from "./accountStore";

const styles = {
    accountList: {
        display: "flex",
        flexDirection: "column" as const,
        gap: "8px",
        marginBottom: "16px",
        maxHeight: "300px",
        overflowY: "auto" as const,
    },
    accountItem: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 16px",
        backgroundColor: "#2b2d31",
        borderRadius: "8px",
        transition: "background 0.15s ease, transform 0.15s ease",
    },
    accountItemHover: {
        backgroundColor: "#35373c",
        transform: "translateX(4px)",
    },
    accountInfo: {
        display: "flex",
        alignItems: "center",
        gap: "12px",
    },
    accountText: {
        display: "flex",
        flexDirection: "column" as const,
        gap: "2px",
    },
    avatar: {
        width: "40px",
        height: "40px",
        borderRadius: "50%",
        objectFit: "cover" as const,
        transition: "transform 0.15s ease",
    },
    buttonGroup: {
        display: "flex",
        gap: "8px",
    },
    warning: {
        padding: "12px",
        backgroundColor: "#2b2d31",
        borderRadius: "8px",
        marginBottom: "16px",
        borderLeft: "3px solid #949ba4",
    },
    formSection: {
        marginBottom: "16px",
    },
    tabs: {
        display: "flex",
        gap: "8px",
        marginBottom: "16px",
    },
    tab: {
        padding: "8px 16px",
        borderRadius: "4px",
        cursor: "pointer",
        backgroundColor: "transparent",
        border: "none",
        color: "#b5bac1",
        fontWeight: 500,
        fontSize: "14px",
        transition: "all 0.15s ease",
    },
    activeTab: {
        backgroundColor: "#404249",
        color: "#ffffff",
    },
    textarea: {
        width: "100%",
        minHeight: "150px",
        padding: "12px",
        borderRadius: "8px",
        backgroundColor: "#1e1f22",
        border: "1px solid #3f4147",
        color: "#dbdee1",
        fontFamily: "\"Consolas\", \"Monaco\", monospace",
        fontSize: "12px",
        resize: "vertical" as const,
    },
    progress: {
        padding: "16px",
        backgroundColor: "#2b2d31",
        borderRadius: "8px",
        textAlign: "center" as const,
    },
    results: {
        padding: "12px",
        backgroundColor: "#2b2d31",
        borderRadius: "8px",
        marginTop: "12px",
    },
    errorList: {
        maxHeight: "100px",
        overflowY: "auto" as const,
        marginTop: "8px",
        fontSize: "12px",
        color: "#949ba4",
    },
    searchBox: {
        width: "100%",
        padding: "10px 12px",
        marginBottom: "12px",
        borderRadius: "6px",
        backgroundColor: "#1e1f22",
        border: "1px solid #3f4147",
        color: "#dbdee1",
        fontSize: "14px",
        outline: "none",
        transition: "border-color 0.15s ease",
    },
    primaryBtn: {
        background: "#3f4147",
        color: "#ffffff",
        border: "none",
        padding: "6px 12px",
        borderRadius: "4px",
        cursor: "pointer",
        fontWeight: 500,
        fontSize: "13px",
        transition: "background 0.15s ease",
    },
    textBtn: {
        background: "transparent",
        color: "#b5bac1",
        border: "none",
        padding: "6px 12px",
        cursor: "pointer",
        fontWeight: 500,
        fontSize: "13px",
        transition: "color 0.15s ease",
    },
};

interface AccountItemProps {
    account: Account;
    onEdit: (account: Account) => void;
    onDelete: (id: string) => void;
    onSwitch: (account: Account) => void;
    onPinToggle: (id: string, isPinned: boolean) => void;
    isPinned: boolean;
}

function AccountItem({ account, onEdit, onDelete, onSwitch, onPinToggle, isPinned }: AccountItemProps) {
    const defaultAvatar = `https://cdn.discordapp.com/embed/avatars/0.png`;
    const [isHovered, setIsHovered] = useState(false);

    const copyToken = () => {
        navigator.clipboard.writeText(account.token);
    };

    return (
        <div
            style={{ ...styles.accountItem, ...(isHovered ? styles.accountItemHover : {}) }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div style={styles.accountInfo}>
                <img
                    src={account.avatarUrl || defaultAvatar}
                    style={{ ...styles.avatar, ...(isHovered ? { transform: "scale(1.05)" } : {}) }}
                    onError={(e) => { (e.target as HTMLImageElement).src = defaultAvatar; }}
                />
                <div style={styles.accountText}>
                    <Text variant="text-md/semibold" style={{ color: "#ffffff" }}>{account.nickname}</Text>
                    <Text variant="text-xs/normal" style={{ color: "#949ba4", fontFamily: account.discordId ? '"Consolas", "Monaco", monospace' : "inherit" }}>
                        {account.discordId ? `ID: ${account.discordId}` : `Token: ****${account.token.slice(-8)}`}
                    </Text>
                </div>
            </div>
            <div style={styles.buttonGroup}>
                <button
                    onClick={copyToken}
                    title="Copy token"
                    style={{ ...styles.textBtn, padding: "6px", display: "flex", alignItems: "center", justifyContent: "center" }}
                    onMouseOver={(e) => (e.currentTarget.style.color = "#ffffff")}
                    onMouseOut={(e) => (e.currentTarget.style.color = "#b5bac1")}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
                    </svg>
                </button>
                <button
                    onClick={() => onSwitch(account)}
                    style={styles.primaryBtn}
                    onMouseOver={(e) => (e.currentTarget.style.background = "#4e5058")}
                    onMouseOut={(e) => (e.currentTarget.style.background = "#3f4147")}
                >
                    Switch
                </button>
                <button
                    onClick={() => onPinToggle(account.id, isPinned)}
                    style={{ ...styles.textBtn, color: isPinned ? "#f23f43" : "#b5bac1" }}
                    onMouseOver={(e) => (e.currentTarget.style.color = isPinned ? "#f23f43" : "#ffffff")}
                    onMouseOut={(e) => (e.currentTarget.style.color = isPinned ? "#f23f43" : "#b5bac1")}
                >
                    {isPinned ? "Unpin" : "Pin"}
                </button>
                <button
                    onClick={() => onEdit(account)}
                    style={{ ...styles.textBtn, color: "#00a8fc" }}
                >
                    Edit
                </button>
                <button
                    onClick={() => onDelete(account.id)}
                    style={{ ...styles.textBtn, color: "#f23f43" }}
                >
                    Delete
                </button>
            </div>
        </div>
    );
}

interface InvalidAccountItemProps {
    account: Account;
    onRetry: (id: string) => void;
    onDelete: (id: string) => void;
    loading: boolean;
}

function InvalidAccountItem({ account, onRetry, onDelete, loading }: InvalidAccountItemProps) {
    const defaultAvatar = `https://cdn.discordapp.com/embed/avatars/0.png`;
    return (
        <div style={{ ...styles.accountItem, borderLeft: "3px solid #ed4245" }}>
            <div style={styles.accountInfo}>
                <img
                    src={account.avatarUrl || defaultAvatar}
                    style={{ ...styles.avatar, opacity: 0.5 }}
                    onError={(e) => { (e.target as HTMLImageElement).src = defaultAvatar; }}
                />
                <div style={styles.accountText}>
                    <Text variant="text-md/semibold" style={{ color: "#ed4245" }}>{account.nickname}</Text>
                    <Text variant="text-xs/normal" style={{ color: "#b5bac1" }}>Token: ****{account.token.slice(-8)}</Text>
                </div>
            </div>
            <div style={styles.buttonGroup}>
                <Button size={Button.Sizes.SMALL} color={Button.Colors.GREEN} onClick={() => onRetry(account.id)} disabled={loading}>
                    {loading ? "..." : "Retry"}
                </Button>
                <Button size={Button.Sizes.SMALL} color={Button.Colors.RED} look={Button.Looks.LINK} onClick={() => onDelete(account.id)}>Delete</Button>
            </div>
        </div>
    );
}

interface AddEditFormProps {
    account?: Account;
    onSave: (nickname: string, token: string) => void;
    onCancel: () => void;
}

function AddEditForm({ account, onSave, onCancel }: AddEditFormProps) {
    const [nickname, setNickname] = useState(account?.nickname || "");
    const [token, setToken] = useState(account?.token || "");
    const [error, setError] = useState("");

    const handleSubmit = () => {
        if (!nickname.trim()) { setError("Enter a nickname"); return; }
        if (!token.trim()) { setError("Enter a token"); return; }
        if (token.length < 50) { setError("Token too short"); return; }
        onSave(nickname, token);
    };

    const handleAddCurrent = () => {
        const current = getCurrentAccountInfo();
        if (!current) {
            showToast("ERR: Could not get current account", Toasts.Type.FAILURE);
            return;
        }
        setNickname(current.displayName);
        setToken(current.token);
        setError("");
        showToast("OK", Toasts.Type.SUCCESS);
    };

    return (
        <div>
            <div style={styles.warning}>
                <Text variant="text-sm/medium" style={{ color: "#faa61a" }}>
                    never share your token silly!
                </Text>
            </div>
            {!account && (
                <button
                    onClick={handleAddCurrent}
                    style={{ ...styles.primaryBtn, width: "100%", marginBottom: "16px", padding: "10px 16px" }}
                    onMouseOver={(e) => (e.currentTarget.style.background = "#4e5058")}
                    onMouseOut={(e) => (e.currentTarget.style.background = "#3f4147")}
                >
                    Add current account
                </button>
            )}
            <div style={styles.formSection}>
                <Forms.FormTitle style={{ color: "#ffffff" }}>Nickname</Forms.FormTitle>
                <TextInput placeholder="Main, Alt, etc" value={nickname} onChange={setNickname} />
            </div>
            <div style={styles.formSection}>
                <Forms.FormTitle style={{ color: "#ffffff" }}>Token</Forms.FormTitle>
                <TextInput placeholder="Paste token" value={token} onChange={setToken} type="password" />
            </div>
            {error && <Text variant="text-sm/medium" style={{ color: "#f23f43", marginBottom: "12px" }}>{error}</Text>}
            <div style={styles.buttonGroup}>
                <button
                    onClick={handleSubmit}
                    style={{ ...styles.primaryBtn, padding: "8px 16px" }}
                    onMouseOver={(e) => (e.currentTarget.style.background = "#4e5058")}
                    onMouseOut={(e) => (e.currentTarget.style.background = "#3f4147")}
                >
                    {account ? "Save" : "Add"}
                </button>
                <button
                    onClick={onCancel}
                    style={{ ...styles.textBtn, color: "#b5bac1" }}
                    onMouseOver={(e) => (e.currentTarget.style.color = "#ffffff")}
                    onMouseOut={(e) => (e.currentTarget.style.color = "#b5bac1")}
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}

function MassImportForm({ onComplete }: { onComplete: () => void; }) {
    const [tokens, setTokens] = useState("");
    const [isImporting, setIsImporting] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [result, setResult] = useState<MassImportResult | null>(null);

    const handleImport = async () => {
        if (!tokens.trim()) return;
        setIsImporting(true);
        setResult(null);
        const importResult = await massImportTokens(tokens, (current, total) => setProgress({ current, total }));
        setResult(importResult);
        setIsImporting(false);
        if (importResult.success > 0) onComplete();
    };

    if (isImporting) {
        return (
            <div style={styles.progress}>
                <Text variant="text-lg/semibold" style={{ color: "#ffffff" }}>Importing...</Text>
                <Text variant="text-md/normal" style={{ marginTop: "8px", color: "#dbdee1" }}>{progress.current} / {progress.total}</Text>
            </div>
        );
    }

    return (
        <div>
            <div style={styles.warning}>
                <Text variant="text-sm/medium" style={{ color: "#faa61a" }}>
                    Paste tokens below, one per line. Supports email:pass:token format.
                </Text>
            </div>
            <div style={styles.formSection}>
                <Forms.FormTitle style={{ color: "#ffffff" }}>Tokens</Forms.FormTitle>
                <textarea
                    style={styles.textarea}
                    placeholder={"email@example.com:pass:token\nor just tokens"}
                    value={tokens}
                    onChange={(e) => setTokens(e.target.value)}
                />
            </div>
            {result && (
                <div style={styles.results}>
                    <Text variant="text-md/semibold" style={{ color: "#dbdee1" }}>
                        {result.success} imported, {result.failed} failed
                    </Text>
                    {result.errors.length > 0 && (
                        <div style={styles.errorList}>
                            {result.errors.map((err, i) => <div key={i}>{err}</div>)}
                        </div>
                    )}
                </div>
            )}
            <div style={styles.buttonGroup}>
                <button
                    onClick={handleImport}
                    disabled={!tokens.trim()}
                    style={{ ...styles.primaryBtn, padding: "8px 16px", opacity: tokens.trim() ? 1 : 0.5, cursor: tokens.trim() ? "pointer" : "not-allowed" }}
                    onMouseOver={(e) => { if (tokens.trim()) e.currentTarget.style.background = "#4e5058"; }}
                    onMouseOut={(e) => (e.currentTarget.style.background = "#3f4147")}
                >
                    Import
                </button>
            </div>
        </div>
    );
}

interface AccountModalProps {
    onSwitch: (account: Account) => void;
}

type TabType = "accounts" | "pinned" | "add" | "import" | "invalid";

function AccountModalContent({ onSwitch }: AccountModalProps) {
    const [accounts, setAccounts] = useState<Account[]>(getAccounts());
    const [invalidAccounts, setInvalidAccounts] = useState<Account[]>(getInvalidAccounts());
    const [editingAccount, setEditingAccount] = useState<Account | null>(null);
    const [activeTab, setActiveTab] = useState<TabType>("accounts");
    const [retryLoading, setRetryLoading] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

    const refresh = () => {
        setAccounts(getAccounts());
        setInvalidAccounts(getInvalidAccounts());
    };

    const handleAddAccount = (nickname: string, token: string) => {
        try {
            addAccount(nickname, token);
            refresh();
            setActiveTab("accounts");
        } catch (e) { }
    };

    const handleEditAccount = (nickname: string, token: string) => {
        if (editingAccount) {
            updateAccount(editingAccount.id, nickname, token);
            refresh();
            setEditingAccount(null);
            setActiveTab("accounts");
        }
    };

    const handleDeleteAccount = (id: string) => {
        deleteAccount(id);
        refresh();
    };

    const handleRetryInvalid = async (id: string) => {
        setRetryLoading(id);
        await retryValidateAccount(id);
        refresh();
        setRetryLoading(null);
    };

    const handleDeleteInvalid = (id: string) => {
        deleteInvalidAccount(id);
        refresh();
    };

    const handlePinToggle = (id: string, isPinned: boolean) => {
        if (isPinned) {
            unpinAccount(id);
        } else {
            pinAccount(id);
        }
        refresh();
    };

    if (editingAccount) {
        return <AddEditForm account={editingAccount} onSave={handleEditAccount} onCancel={() => setEditingAccount(null)} />;
    }

    return (
        <div>
            <div style={styles.tabs}>
                <button style={{ ...styles.tab, ...(activeTab === "accounts" ? styles.activeTab : {}) }} onClick={() => setActiveTab("accounts")}>
                    Accounts ({accounts.length})
                </button>
                <button style={{ ...styles.tab, ...(activeTab === "pinned" ? styles.activeTab : {}) }} onClick={() => setActiveTab("pinned")}>
                    Pinned ({getPinnedAccounts().length})
                </button>
                <button style={{ ...styles.tab, ...(activeTab === "add" ? styles.activeTab : {}) }} onClick={() => setActiveTab("add")}>
                    Add
                </button>
                <button style={{ ...styles.tab, ...(activeTab === "import" ? styles.activeTab : {}) }} onClick={() => setActiveTab("import")}>
                    Import
                </button>
                {invalidAccounts.length > 0 && (
                    <button style={{ ...styles.tab, ...(activeTab === "invalid" ? { ...styles.activeTab, color: "#f23f43" } : { color: "#f23f43" }) }} onClick={() => setActiveTab("invalid")}>
                        Invalid ({invalidAccounts.length})
                    </button>
                )}
            </div>

            {activeTab === "accounts" && (
                <div>
                    {accounts.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "24px" }}>
                            <Text variant="text-md/normal" style={{ color: "#b5bac1" }}>No accounts yet</Text>
                        </div>
                    ) : (
                        <>
                            <input
                                type="text"
                                placeholder="Search by name, ID, or token..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                style={styles.searchBox}
                            />
                            <div style={styles.accountList}>
                                {accounts
                                    .filter(acc => {
                                        if (!searchQuery.trim()) return true;
                                        let q = searchQuery.trim().toLowerCase();
                                        if (q.length > 50) q = q.slice(-8);
                                        return acc.nickname.toLowerCase().includes(q) ||
                                            (acc.discordId && acc.discordId.includes(q)) ||
                                            acc.token.slice(-8).toLowerCase().includes(q) ||
                                            acc.token.toLowerCase() === searchQuery.trim().toLowerCase();
                                    })
                                    .map(account => (
                                        <AccountItem
                                            key={account.id}
                                            account={account}
                                            onEdit={setEditingAccount}
                                            onDelete={handleDeleteAccount}
                                            onSwitch={onSwitch}
                                            onPinToggle={handlePinToggle}
                                            isPinned={isAccountPinned(account.id)}
                                        />
                                    ))}
                            </div>
                            <button
                                style={{ ...styles.primaryBtn, marginTop: "12px", width: "100%", padding: "10px 16px" }}
                                onMouseOver={(e) => (e.currentTarget.style.background = "#4e5058")}
                                onMouseOut={(e) => (e.currentTarget.style.background = "#3f4147")}
                                onClick={() => {
                                    const tokens = accounts.map(a => a.token).join("\n");
                                    navigator.clipboard.writeText(tokens);
                                    showToast(`OK: Copied ${accounts.length} tokens`, Toasts.Type.SUCCESS);
                                }}
                            >
                                Copy All Tokens
                            </button>
                            <button
                                style={{ ...styles.primaryBtn, marginTop: "8px", width: "100%", padding: "10px 16px" }}
                                onMouseOver={(e) => (e.currentTarget.style.background = "#4e5058")}
                                onMouseOut={(e) => (e.currentTarget.style.background = "#3f4147")}
                                onClick={async () => {
                                    showToast("Refreshing...", Toasts.Type.MESSAGE);
                                    const result = await refreshAllAccounts();
                                    refresh();
                                    showToast(`OK: ${result.updated} updated, ${result.failed} failed`, Toasts.Type.SUCCESS);
                                }}
                            >
                                Refresh Accounts
                            </button>
                        </>
                    )}
                </div>
            )}

            {activeTab === "pinned" && (
                <div>
                    {getPinnedAccounts().length === 0 ? (
                        <div style={{ textAlign: "center", padding: "24px" }}>
                            <Text variant="text-md/normal" style={{ color: "#b5bac1" }}>No pinned accounts</Text>
                        </div>
                    ) : (
                        <div style={styles.accountList}>
                            {getPinnedAccounts().map(account => (
                                <AccountItem
                                    key={account.id}
                                    account={account}
                                    onEdit={setEditingAccount}
                                    onDelete={handleDeleteAccount}
                                    onSwitch={onSwitch}
                                    onPinToggle={handlePinToggle}
                                    isPinned={true}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {activeTab === "invalid" && (
                <div>
                    {invalidAccounts.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "24px" }}>
                            <Text variant="text-md/normal" style={{ color: "#b5bac1" }}>No invalid accounts</Text>
                        </div>
                    ) : (
                        <div style={styles.accountList}>
                            {invalidAccounts.map(account => (
                                <InvalidAccountItem
                                    key={account.id}
                                    account={account}
                                    onRetry={handleRetryInvalid}
                                    onDelete={handleDeleteInvalid}
                                    loading={retryLoading === account.id}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {activeTab === "add" && <AddEditForm onSave={handleAddAccount} onCancel={() => setActiveTab("accounts")} />}
            {activeTab === "import" && <MassImportForm onComplete={() => { refresh(); setActiveTab("accounts"); }} />}
        </div>
    );
}

export function openAccountModal(onSwitch: (account: Account) => void) {
    openModal(props => (
        <ModalRoot {...props} size={ModalSize.MEDIUM}>
            <ModalHeader>
                <Text variant="heading-lg/semibold" style={{ color: "#ffffff" }}>Account Switcher</Text>
                <ModalCloseButton onClick={props.onClose} />
            </ModalHeader>
            <ModalContent>
                <div style={{ padding: "16px" }}>
                    <AccountModalContent onSwitch={onSwitch} />
                </div>
            </ModalContent>
            <ModalFooter>
                <Text variant="text-xs/normal" style={{ color: "#b5bac1" }}>Right-click users to switch</Text>
            </ModalFooter>
        </ModalRoot>
    ));
}
