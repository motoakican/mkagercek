import { getColor } from '../../config/bot.js';
import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { getLevelingConfig, saveLevelingConfig } from '../../services/leveling/leveling.js';
import { botHasPermission } from '../../utils/permissionGuard.js';
import { TitanBotError, ErrorTypes, replyUserError } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { logger } from '../../utils/logger.js';
import levelDashboard from './modules/level_dashboard.js';

export default {
    data: new SlashCommandBuilder()
        .setName('seviye')
        .setDescription('Seviye sistemini yönetir')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false)
        .addSubcommand((subcommand) =>
            subcommand
                .setName('kurulum')
                .setDescription('Seviye sistemini kurar — bu işlem sistemi aynı zamanda etkinleştirir')
                .addChannelOption((option) =>
                    option
                        .setName('kanal')
                        .setDescription('Seviye atlama bildirimlerinin gönderileceği kanal')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true),
                )
                .addIntegerOption((option) =>
                    option
                        .setName('xp_min')
                        .setDescription('Mesaj başına verilecek minimum XP (varsayılan: 15)')
                        .setMinValue(1)
                        .setMaxValue(500)
                        .setRequired(false),
                )
                .addIntegerOption((option) =>
                    option
                        .setName('xp_max')
                        .setDescription('Mesaj başına verilecek maksimum XP (varsayılan: 25)')
                        .setMinValue(1)
                        .setMaxValue(500)
                        .setRequired(false),
                )
                .addStringOption((option) =>
                    option
                        .setName('mesaj')
                        .setDescription(
                            'Seviye atlama mesajı. Yer tutucu olarak {user} ve {level} kullanabilirsiniz',
                        )
                        .setMaxLength(500)
                        .setRequired(false),
                )
                .addIntegerOption((option) =>
                    option
                        .setName('xp_bekleme_suresi')
                        .setDescription('Kullanıcıların tekrar XP kazanması için gereken saniye (varsayılan: 60)')
                        .setMinValue(0)
                        .setMaxValue(3600)
                        .setRequired(false),
                ),
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('panel')
                .setDescription('Etkileşimli seviye yapılandırma panelini açar'),
        ),
    category: 'Leveling',

    async execute(interaction, config, client) {
        const deferred = await InteractionHelper.safeDefer(interaction, {
            flags: MessageFlags.Ephemeral,
        });
        if (!deferred) return;

        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
            return await replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: 'Bu komutu kullanmak için **Sunucuyu Yönet** yetkisine ihtiyacın var.' });
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'panel') {
            return levelDashboard.execute(interaction, config, client);
        }

        if (subcommand === 'kurulum') {
            const channel = interaction.options.getChannel('kanal');
            const xpMin = interaction.options.getInteger('xp_min') ?? 15;
            const xpMax = interaction.options.getInteger('xp_max') ?? 25;
            const message =
                interaction.options.getString('mesaj') ??
                '{user}, {level}. seviyeye ulaştı!';
            const xpCooldown = interaction.options.getInteger('xp_bekleme_suresi') ?? 60;

            if (xpMin > xpMax) {
                return await replyUserError(interaction, { type: ErrorTypes.VALIDATION, message: `Minimum XP (**${xpMin}**), maksimum XP'den (**${xpMax}**) büyük olamaz.` });
            }

            if (!botHasPermission(channel, ['SendMessages', 'EmbedLinks'])) {
                throw new TitanBotError(
                    'Bot belirtilen kanalda gerekli yetkilere sahip değil',
                    ErrorTypes.PERMISSION,
                    `Seviye atlama bildirimleri gönderebilmek için ${channel} kanalında **Mesaj Gönder** ve **Bağlantı Yerleştir** yetkilerine ihtiyacım var.`,
                );
            }

            const existingConfig = await getLevelingConfig(client, interaction.guildId);

            if (existingConfig.configured) {
                return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: `Bu sunucuda seviye sistemi zaten ayarlanmış (seviye atlama bildirimleri <#${existingConfig.levelUpChannel}> kanalına gidiyor).\n\nAyarları değiştirmek için \`/seviye panel\` komutunu kullan.` });
            }

            const newConfig = {
                ...existingConfig,
                configured: true,
                enabled: true,
                levelUpChannel: channel.id,
                xpRange: { min: xpMin, max: xpMax },
                xpCooldown: xpCooldown,
                levelUpMessage: message,
                announceLevelUp: true,
            };

            await saveLevelingConfig(client, interaction.guildId, newConfig);

            logger.info(`Seviye sistemi ${interaction.guildId} sunucusunda kuruldu`, {
                channelId: channel.id,
                xpMin,
                xpMax,
                xpCooldown,
                userId: interaction.user.id,
            });

            return await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    createEmbed({
                        title: 'Seviye Sistemi Kuruldu',
                        description:
                            `Seviye sistemi artık **etkinleştirildi** ve kullanıma hazır.\n\n` +
                            `**Seviye Kanalı:** ${channel}\n` +
                            `**Mesaj Başına XP:** ${xpMin} – ${xpMax}\n` +
                            `**XP Bekleme Süresi:** ${xpCooldown}s\n` +
                            `**Seviye Atlama Mesajı:** \`${message}\`\n\n` +
                            `İstediğin zaman ayarları değiştirmek için \`/seviye panel\` komutunu kullanabilirsin.`,
                        color: 'success',
                    }),
                ],
            });
        }
    },
};
