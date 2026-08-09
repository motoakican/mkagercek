import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

import dashboard from './modules/logging_dashboard.js';
import channel from './modules/logging_channel.js';

import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';
export default {
    data: new SlashCommandBuilder()
        .setName('loglama')
        .setDescription('Sunucu loglamasını yönetin — kanallar, filtreler ve etkinlik kategorileri.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false)
        .addSubcommand((subcommand) =>
            subcommand
                .setName('panel')
                .setDescription('Loglama panelini açar — kanalları, filtreleri ayarlayın ve kategorileri açıp kapatın.'),
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('kanal')
                .setDescription('Paneli açmadan hızlıca bir log kanalı ayarlayın.')
                .addStringOption((option) =>
                    option
                        .setName('hedef')
                        .setDescription('Hangi log hedefinin yapılandırılacağı.')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Denetim (moderasyon, mesajlar, üyeler…)', value: 'audit' },
                            { name: 'Başvurular', value: 'applications' },
                            { name: 'Raporlar', value: 'reports' },
                        ),
                )
                .addChannelOption((option) =>
                    option
                        .setName('kanal')
                        .setDescription('Loglar için metin kanalı.')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(false),
                )
                .addBooleanOption((option) =>
                    option
                        .setName('devre-disi-birak')
                        .setDescription('Bu log kanalını temizlemek için Doğru (True) yapın.')
                        .setRequired(false),
                ),
        ),

    async execute(interaction, config, client) {
        try {
            const subcommand = interaction.options.getSubcommand();

            if (subcommand === 'panel') {
                return await dashboard.execute(interaction, config, client);
            }

            if (subcommand === 'kanal') {
                return await channel.execute(interaction, config, client);
            }

            await replyUserError(interaction, { type: ErrorTypes.VALIDATION, message: 'Bu alt komut tanınmadı.' });
        } catch (error) {
            logger.error('loglama komut hatası:', error);
            await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Beklenmeyen bir hata oluştu.' }).catch(() => {});
        }
    },
};